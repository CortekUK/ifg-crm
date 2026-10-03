import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo";
import { ContactView } from "@/components/contact";
import { CONTACT } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = pageMeta({
  title: "Contact us",
  description:
    "Get in touch with The International Football Group to hear more about our programmes — email, call, book a call or send us a message.",
  path: "/contact",
});

export default async function Page() {
  return <ContactView data={mergePage(CONTACT, await getPage("contact"))} />;
}
