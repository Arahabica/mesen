import MozaicEditor from '@/components/MozaicEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'モザイクかけ',
  description: 'プライバシーを守るモザイク加工ツール。画像に簡単にモザイクを追加できます。',
  openGraph: {
    title: 'モザイクかけ',
    description: 'プライバシーを守るモザイク加工ツール',
    images: ['/og-image.png'],
  },
};

export default function MozaicPage() {
  return <MozaicEditor />;
}