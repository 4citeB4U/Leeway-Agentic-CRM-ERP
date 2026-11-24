/*
LEEWAY HEADER — DO NOT REMOVE
REGION: LEEWAY.CRM_ERP.RUNTIME_ONBOARDING_PROJECTION.TEST
TAG: LEEWAY.CRM_ERP.VERIFIED_CUSTOMER_REGISTRATION.NEGATIVE_V1
5WH:
WHAT = Prove that only original Runtime-verified customer registrations create CRM and ERP projections.
WHY = Invitation opens, health pings, duplicate events or unconsented marketing cannot inflate Creator customer records.
WHO = Creator-authorized QA outside contributor; synthetic fixtures do not prove live Runtime or CRM writes.
WHERE = tests/runtime-onboarding-projection.test.mjs.
WHEN = 2026-11-24.
HOW = Node source tests with injected mock Runtime, atomic ledger and Creator read providers.
LICENSE = Existing repository terms.
*/
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeVerifiedSignup,createRuntimeCustomerCrmProjection} from '../modules/runtime-onboarding-projection.mjs';
const reference='event:verified-onboard-000000000001';
function verified(override={}){
 return {
  source:'ORIGINAL_RUNTIME_ZITADEL_ACCOUNT_ADMISSION',
  type:'customer.registration.verified',status:'AUTHORIZED',
  eventRef:reference,businessTenantRef:'creator-business-001',
  customerTenantRef:'customer-tenant-123',customerSubjectRef:'zitadel-sub-123',
  verifiedEmail:true,email:'Customer@Example.com',displayName:'Example Customer',
  registeredAt:'2026-11-24T11:00:00Z',
  registrationKind:'CUSTOMER',creatorRights:false,edition:'PERSONAL',
  marketingConsent:{choice:'OPT_OUT'},...override
 };
}
function providers(source=verified()){
 const stored=new Map();const calls=[];
 return {
  calls,
  api:createRuntimeCustomerCrmProjection({
   verifyOriginalRuntimeEvent:async ({internalEventRef})=>{
    calls.push({type:'verify',internalEventRef});return source;
   },
   commitOriginalCrmErpTransaction:async ({internalEventRef,projection})=>{
    calls.push({type:'commit',internalEventRef});
    if(stored.has(internalEventRef))return {status:'ALREADY_COMMITTED'};
    stored.set(internalEventRef,{sourceDigest:projection.sourceDigest,
     contactId:projection.contact.contactId,accountId:projection.account.accountId});
    return {status:'COMMITTED'};
   },
   readOriginalCrmErpProjection:async ({internalEventRef})=>stored.get(internalEventRef),
   authorizeCreatorBusinessRead:async ({businessTenantRef})=>({
    verified:true,scope:'CRM_ERP_CREATOR_BUSINESS_READ',businessTenantRef,isCreator:true
   }),
   readOriginalCreatorMetrics:async ()=>({
    invitationsIssued:3,invitationsRedeemed:2,verifiedAccounts:2,
    registeredContacts:2,enrolledDevices:1,activeAccounts:2,marketingOptIns:0
   })
  })
 };
}
test('verified customer creates separate CRM contact, ERP account without revenue/device claims',async()=>{
 const c=normalizeVerifiedSignup(verified());
 assert.equal(c.contact.verifiedEmail,'customer@example.com');
 assert.equal(c.contact.marketing.canSendMarketing,false);
 assert.equal(c.contact.messageSent,false);
 assert.equal(c.account.status,'REGISTERED');
 assert.equal(c.account.billedRevenue,'NOT_ASSERTED');
 assert.equal(c.account.nativeDevicesEnrolled,'NOT_ASSERTED');
 assert.notEqual(c.businessTenantRef,c.customerTenantRef);
});
test('actual original verified event is committed exactly once and read back before confirmed',async()=>{
 const p=providers();
 const a=await p.api.accept({internalEventRef:reference});
 const b=await p.api.accept({internalEventRef:reference});
 assert.equal(a.status,'VERIFIED_ONBOARDING_PROJECTED');
 assert.equal(b.status,a.status);
 assert.equal(a.accountRef,b.accountRef);
 assert.equal(a.contactRef,b.contactRef);
 assert.equal(a.emailsSent,0);
 assert.equal(p.calls.filter(x=>x.type==='commit').length,2);
});
test('invitation click and unverified Zitadel email cannot create customer',()=>{
 for(const override of [
  {type:'invite.opened'},{type:'customer.invitation.redeemed'},
  {verifiedEmail:false},{email:'invalid-email'},
  {creatorRights:true},{registrationKind:'CREATOR'},
  {status:'PENDING'},{source:'GITHUB_PAGES_BROWSER'},
  {businessTenantRef:'customer-tenant-123'}
 ])assert.throws(()=>normalizeVerifiedSignup(verified(override)),/ORIGINAL_RUNTIME_REGISTRATION_NOT_VERIFIED|BUSINESS_CUSTOMER_TENANT_COLLISION/);
});
test('marketing is DENIED by default and requires evidence of explicit separate user consent',()=>{
 const optin=verified({marketingConsent:{choice:'OPT_IN',source:'EXPLICIT_SEPARATE_USER_CHOICE',
  evidenceRef:'consent:verifiable-001',noticeVersion:'marketing-v1',
  consentedAt:'2026-11-24T11:00:00Z'}});
 assert.equal(normalizeVerifiedSignup(optin).contact.marketing.canSendMarketing,true);
 assert.throws(()=>normalizeVerifiedSignup(verified({marketingConsent:{
  choice:'OPT_IN',source:'PRECHECKED_BOX',evidenceRef:'consent:x',noticeVersion:'v1',
  consentedAt:'2026-11-24T11:00:00Z'
 }})),/MARKETING_CONSENT_EVIDENCE_UNVERIFIED/);
 assert.equal(normalizeVerifiedSignup(verified({marketingConsent:null})).contact.marketing.canSendMarketing,false);
});
test('browser-submitted email or mismatched internal event reference cannot be projected',async()=>{
 const p=providers();
 await assert.rejects(()=>p.api.accept({internalEventRef:'https://evil.example'}),/SOURCE_EVENT_REFERENCE_INVALID/);
 await assert.rejects(()=>p.api.accept({internalEventRef:'event:other-customer-001'}),/EVENT_CORRELATION_INVALID/);
 assert.equal(p.calls.filter(x=>x.type==='commit').length,0);
});
test('failed atomic CRM/ERP readback is not a completed registered customer',async()=>{
 const p=createRuntimeCustomerCrmProjection({
  verifyOriginalRuntimeEvent:async ()=>verified(),
  commitOriginalCrmErpTransaction:async ()=>({status:'COMMITTED'}),
  readOriginalCrmErpProjection:async ()=>({contactId:'wrong',accountId:'wrong',sourceDigest:'0'}),
  authorizeCreatorBusinessRead:async ()=>({verified:false}),
  readOriginalCreatorMetrics:async ()=>({})
 });
 await assert.rejects(()=>p.accept({internalEventRef:reference}),/ATOMIC_READBACK_NOT_VERIFIED/);
});
test('Creator summary is authenticated and contains only aggregate counts, never raw customer email',async()=>{
 const p=providers();
 const summary=await p.api.creatorSummary({
  creatorSessionRef:'creator-session-001',businessTenantRef:'creator-business-001'
 });
 assert.equal(summary.verifiedAccounts,2);
 assert.equal(summary.enrolledDevices,1);
 assert.equal(summary.invitationsIssued,3);
 assert.equal(summary.customerEmailsIncluded,false);
 assert.equal('email' in summary,false);
});
test('non-Creator cannot inspect entire business customer totals',async()=>{
 const p=createRuntimeCustomerCrmProjection({
  verifyOriginalRuntimeEvent:async ()=>verified(),
  commitOriginalCrmErpTransaction:async ()=>({status:'COMMITTED'}),
  readOriginalCrmErpProjection:async ()=>({}),
  authorizeCreatorBusinessRead:async ()=>({
   verified:true,scope:'CRM_ERP_CREATOR_BUSINESS_READ',
   businessTenantRef:'creator-business-001',isCreator:false
  }),
  readOriginalCreatorMetrics:async ()=>({verifiedAccounts:999})
 });
 await assert.rejects(()=>p.creatorSummary({
  creatorSessionRef:'customer-session-001',businessTenantRef:'creator-business-001'
 }),/CREATOR_BUSINESS_READ_DENIED/);
});
test('no CRM/ERP source mutation available without all original injected providers',()=>{
 assert.throws(()=>createRuntimeCustomerCrmProjection({}),/CANONICAL_PROVIDER_UNBOUND/);
});
