import { redirect } from 'next/navigation';

/** The focus timer lives on Home now. */
export default function Page() {
  redirect('/');
}
