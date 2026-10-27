import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Pos from '../src/pos';
export default async function Page() {
  if (!(await cookies()).has('salonos_access')) redirect('/login');
  return <Pos />;
}
