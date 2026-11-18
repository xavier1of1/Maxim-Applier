import {z} from 'zod';

export const kinds = ['application_review','weekly_review','resume_review','high_fit','needs_response','networking_review','recruiter_reminder'] as const;
export const kindSchema = z.enum(kinds);
export type NotificationKind = z.infer<typeof kindSchema>;
export const planSchema = z.object({kind:kindSchema,entityId:z.string().uuid().optional()}).strict();
export type PlanInput = z.infer<typeof planSchema>;
export type Plan = {kind:NotificationKind;entityId?:string;eligible:boolean;reason:string;identity:string;
 payloadRevision:1;payload:{content:string;allowed_mentions:{parse:string[]};flags:number};
 counts:{submitted:number;applicationReview:number;needsResponse:number;networkingReview:number;recruiterReminder:number};asOf:string};
export type ScheduleSpec = {kind:'application_review'|'weekly_review'|'resume_review';timezone:string;anchorDate:string;localTime:string};
export type Outcome = {state:'accepted'|'retry'|'failed'|'uncertain';httpStatus?:number;code:string;remoteId?:string;retrySeconds?:number};
