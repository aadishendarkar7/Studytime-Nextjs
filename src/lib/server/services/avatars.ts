import 'server-only';
import { getStorage } from '../storage';
import { HttpError } from '../http';

/** Profile pictures: one small square JPEG or WebP per account, resized in the browser before upload. */
const KEY = (id: string) => `avatar:${id}`;
export const MAX_AVATAR = 120_000;

export async function setAvatar(id: string, data: string) {
  if (!/^data:image\/(jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(data) || data.length > MAX_AVATAR) throw new HttpError(400, 'That picture could not be used. Try another.');
  await getStorage().set(KEY(id), data);
}

export async function removeAvatar(id: string) {
  await getStorage().del(KEY(id));
}

export async function getAvatar(id: string) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) throw new HttpError(404, 'No picture.');
  const data = await getStorage().get<string>(KEY(id));
  if (!data) throw new HttpError(404, 'No picture.');
  const [, type, b64] = /^data:(image\/(?:jpeg|webp));base64,(.+)$/.exec(data) ?? [];
  if (!type) throw new HttpError(404, 'No picture.');
  return { type, bytes: Buffer.from(b64, 'base64') };
}
