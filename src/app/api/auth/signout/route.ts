import { clearCookie, withCookies } from '@/lib/server/accounts';
import { handle } from '@/lib/server/http';

export const POST = handle(async (request: Request) => withCookies({ ok: true }, [clearCookie(request)]));
