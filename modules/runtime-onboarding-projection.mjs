/*
LEEWAY HEADER — DO NOT REMOVE
REGION: LEEWAY.CRM_ERP.RUNTIME_ONBOARDING_PROJECTION
TAG: LEEWAY.CRM_ERP.VERIFIED_CUSTOMER_REGISTRATION_V1
5WH:
WHAT = Project original authenticated Runtime customer signup into Creator CRM contact and ERP account without duplicating identity.
WHY = The Creator needs reliable customer totals, verified emails, contact permission and account lifecycle in Tablet CRM/ERP.
WHO = Creator-authorized CRM/ERP business service under original Runtime/Zitadel/Veritas/Receipt, not a public GitHub Pages form.
WHERE = modules/runtime-onboarding-projection.mjs in 4citeB4U/Leeway-Agentic-CRM-ERP.
WHEN = 2026-11-24.
HOW = Require trusted server enrollment event, atomic authorized CRM/ERP projection with readback, and separate marketing consent.
LICENSE = Existing repository terms; no new customer-data authorization claimed.
*/
import {createHash} from 'node:crypto';

const deny=code=>{const e=new Error('LEEWAY_CRM_ONBOARDING_'+code);e.code=e.message;throw e};
const reference=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:@/-]{3,159}$/.test(v);
const eventRef=v=>typeof v==='string'&&/^event:[A-Za-z0-9._:-]{8,150}$/.test(v);
const email=v=>typeof v==='string'&&v.length<=254&&
 /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&!/[<>\r\n\u0000]/.test(v);
const hash=v=>createHash('sha256').update(v).digest('hex');
const exactKeys=(object,allow)=>{
 if(!object||typeof object!=='object'||Array.isArray(object))deny('SOURCE_INVALID');
 for(const k of Object.keys(object))if(!allow.has(k))deny('PRIVATE_OR_UNEXPECTED_SOURCE_FIELD');
};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/i.test(v);
function verifyEnrollment(v,ref){
 if(!v||v.source!=='ORIGINAL_RUNTIME_ZITADEL_ACCOUNT_ADMISSION'||
    v.type!=='customer.registration.verified'||v.status!=='AUTHORIZED'||
    v.eventRef!==ref||!reference(v.businessTenantRef)||!reference(v.customerTenantRef)||
    !reference(v.customerSubjectRef)||v.verifiedEmail!==true||!email(v.email)||
    typeof v.displayName!=='string'||!v.displayName.trim()||
    v.displayName.length>120||!Number.isFinite(Date.parse(v.registeredAt))||
    v.registrationKind!=='CUSTOMER'||v.creatorRights!==false)
   deny('ORIGINAL_RUNTIME_REGISTRATION_NOT_VERIFIED');
 if(v.businessTenantRef===v.customerTenantRef)deny('BUSINESS_CUSTOMER_TENANT_COLLISION');
 if(!['PERSONAL','INDUSTRIAL'].includes(v.edition))deny('EDITION_UNVERIFIED');
 // An invitation click, unverified email, phone health ping, or account view
 // is never a verified CUSTOMER REGISTRATION event.
 return v;
}
function marketingPermission(event){
 const c=event.marketingConsent;
 if(!c||c.choice!=='OPT_IN')return Object.freeze({
   status:'NO_MARKETING_CONSENT',canSendMarketing:false,consentEvidenceRef:null
 });
 if(c.source!=='EXPLICIT_SEPARATE_USER_CHOICE'||!reference(c.evidenceRef)||
    typeof c.noticeVersion!=='string'||c.noticeVersion.length>80||
    !/^[A-Za-z0-9._-]+$/.test(c.noticeVersion)||
    !Number.isFinite(Date.parse(c.consentedAt)))
    deny('MARKETING_CONSENT_EVIDENCE_UNVERIFIED');
 return Object.freeze({
   status:'MARKETING_OPT_IN_VERIFIED',canSendMarketing:true,
   consentEvidenceRef:c.evidenceRef,noticeVersion:c.noticeVersion,
   consentedAt:c.consentedAt
 });
}
export function normalizeVerifiedSignup(event){
 if(!eventRef(event?.eventRef))deny('SOURCE_EVENT_REFERENCE_INVALID');
 const source=verifyEnrollment(event,event.eventRef);
 const contactId='leeway-contact-'+hash(source.businessTenantRef+'\0'+source.customerSubjectRef).slice(0,32);
 const accountId='leeway-account-'+hash(source.customerTenantRef+'\0'+source.customerSubjectRef).slice(0,32);
 const consent=marketingPermission(source);
 const projection={
  schema:'leeway.crm-erp.customer-onboarding.v1',
  sourceAuthority:'ORIGINAL_RUNTIME_ZITADEL_ACCOUNT_ADMISSION',
  eventRef:source.eventRef,
  businessTenantRef:source.businessTenantRef,
  customerTenantRef:source.customerTenantRef,
  contact:Object.freeze({
   contactId,businessTenantRef:source.businessTenantRef,
   source:'LEEWAY_DEVICE_BRIDGE_INVITED_REGISTRATION',
   displayName:source.displayName.trim(),verifiedEmail:source.email.toLowerCase(),
   emailVerified:true,registeredAt:source.registeredAt,
   serviceCommunication:'ACCOUNT_SERVICE_ONLY',
   marketing:consent,
   status:'REGISTERED_CUSTOMER',
   messageSent:false
  }),
  account:Object.freeze({
   accountId,customerTenantRef:source.customerTenantRef,contactId,
   edition:source.edition,status:'REGISTERED',
   createdAt:source.registeredAt,subscriptionStatus:'NOT_ASSERTED',
   billedRevenue:'NOT_ASSERTED',nativeDevicesEnrolled:'NOT_ASSERTED'
  })
 };
 return Object.freeze({...projection,sourceDigest:hash(JSON.stringify(projection))});
}

export function createRuntimeCustomerCrmProjection({
 verifyOriginalRuntimeEvent,commitOriginalCrmErpTransaction,
 readOriginalCrmErpProjection,authorizeCreatorBusinessRead,readOriginalCreatorMetrics
}={}){
 for(const fn of [verifyOriginalRuntimeEvent,commitOriginalCrmErpTransaction,
   readOriginalCrmErpProjection,authorizeCreatorBusinessRead,readOriginalCreatorMetrics])
  if(typeof fn!=='function')deny('CANONICAL_PROVIDER_UNBOUND');
 return Object.freeze({
  async accept({internalEventRef}={}){
   if(!eventRef(internalEventRef))deny('SOURCE_EVENT_REFERENCE_INVALID');
   // The caller supplies only an opaque reference: NEVER email or a claimed
   // Creator role from GitHub Pages, a browser extension, or an invite URL.
   const verified=await verifyOriginalRuntimeEvent({internalEventRef});
   if(verified?.eventRef!==internalEventRef)deny('EVENT_CORRELATION_INVALID');
   const projection=normalizeVerifiedSignup(verified);
   const result=await commitOriginalCrmErpTransaction({
    businessTenantRef:projection.businessTenantRef,
    internalEventRef,projection,
    // Unique CUSTOMER identity is the durable business count. Multiple browser
    // sessions or retried event references cannot increment registrations.
    idempotencyKey:'customer.registration:'+projection.businessTenantRef+':'+projection.account.accountId
   });
   if(result?.status!=='COMMITTED'&&result?.status!=='ALREADY_COMMITTED')
    deny('ATOMIC_CRM_ERP_COMMIT_NOT_VERIFIED');
   const read=await readOriginalCrmErpProjection({
    businessTenantRef:projection.businessTenantRef,internalEventRef
   });
   if(read?.sourceDigest!==projection.sourceDigest||
      read?.contactId!==projection.contact.contactId||
      read?.accountId!==projection.account.accountId)
    deny('ATOMIC_READBACK_NOT_VERIFIED');
   return Object.freeze({
    status:'VERIFIED_ONBOARDING_PROJECTED',
    businessTenantRef:projection.businessTenantRef,
    internalEventRef,sourceDigest:projection.sourceDigest,
    contactRef:projection.contact.contactId,
    accountRef:projection.account.accountId,
    marketingAllowed:projection.contact.marketing.canSendMarketing,
    emailsSent:0,deviceExecution:'NOT_ASSERTED',
    independentVeritas:'NOT_ASSERTED'
   });
  },
  async creatorSummary({creatorSessionRef,businessTenantRef}={}){
   if(!reference(creatorSessionRef)||!reference(businessTenantRef))
    deny('BUSINESS_SUMMARY_REQUEST_INVALID');
   const grant=await authorizeCreatorBusinessRead({creatorSessionRef,businessTenantRef});
   if(grant?.verified!==true||grant?.scope!=='CRM_ERP_CREATOR_BUSINESS_READ'||
      grant?.businessTenantRef!==businessTenantRef||grant?.isCreator!==true)
     deny('CREATOR_BUSINESS_READ_DENIED');
   const metrics=await readOriginalCreatorMetrics({businessTenantRef});
   const keys=['invitationsIssued','invitationsRedeemed','verifiedAccounts',
     'registeredContacts','enrolledDevices','activeAccounts','marketingOptIns'];
   exactKeys(metrics,new Set(keys));
   for(const key of keys)if(!Number.isSafeInteger(metrics[key])||metrics[key]<0)
     deny('CREATOR_METRICS_READBACK_INVALID');
   return Object.freeze({businessTenantRef,source:'ORIGINAL_CRM_ERP_RUNTIME_READBACK',
     ...metrics,customerEmailsIncluded:false,scope:'CRM_ERP_CREATOR_BUSINESS_READ'});
  }
 });
}
