import { Header, Footer } from "@/components/chrome";
import { AccountPanel } from "@/components/account-panel";
import { pageMetadata } from "@/lib/seo";
export const metadata = {
  ...pageMetadata(
    "Your Account & Credits",
    "Manage your EditingApp profile, available credits, recent credit activity and subscription.",
    "/account",
  ),
  robots: { index: false, follow: false },
};
export default function AccountPage() {
  return (
    <>
      <Header />
      <main id="main" className="account-page">
        <p className="eyebrow">YOUR EDITINGAPP</p>
        <h1>A space for your ideas.</h1>
        <AccountPanel />
      </main>
      <Footer />
    </>
  );
}
