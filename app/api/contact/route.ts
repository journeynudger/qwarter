import { createContactHandlers } from '@/lib/contact';

export const runtime = 'nodejs';
const handlers = createContactHandlers({url:process.env.CONTACT_WEBHOOK_URL, enabled:process.env.CONTACT_FORM_ENABLED});
export const GET = handlers.GET;
export const POST = handlers.POST;
