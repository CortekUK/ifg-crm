import type { Metadata } from "next";
import { ContactView } from "@/components/contact";
import { CONTACT } from "@/lib/data";
import { getPage } from "@/lib/content";
import { mergePage } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Get in touch",
  description: "Get in touch with The International Football Group to hear more about our programmes — email, call, or send us a message.",
};

export default async function Page() {
  return <ContactView data={mergePage(CONTACT, await getPage("contact"))} />;
}
