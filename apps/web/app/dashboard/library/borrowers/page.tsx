import { redirect } from 'next/navigation';

export default function LibraryBorrowersPage() {
  redirect('/dashboard/library/issue-return');
}
