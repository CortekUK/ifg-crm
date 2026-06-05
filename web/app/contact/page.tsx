import type { Metadata } from "next";
import { ContactView } from "@/components/contact";

export const metadata: Metadata = {
  title: "Get in touch",
  description: "Get in touch with The International Football Group to hear more about our programmes — email, call, or send us a message.",
};

export default function Page() {
  return <ContactView />;
}
