import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/base/card";
import { personConfig, socialConfig } from "@/lib/site-config";

const linkedInUrl = socialConfig.find(
  (social) => social.name.toLowerCase() === "linkedin"
)?.url;

export const metadata: Metadata = {
  title: "Connect",
  description: `Scan to connect with ${personConfig.name} on LinkedIn.`,
};

export default async function ConnectPage() {
  "use cache";
  cacheLife("max");
  if (!linkedInUrl) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Connect</CardTitle>
          <CardDescription>No LinkedIn profile is configured yet.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Connect on LinkedIn</CardTitle>
          <CardDescription>
            Scan this QR code to open my LinkedIn profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="w-full max-w-[240px] rounded-xl bg-white p-4 shadow-xs">
            <QRCode
              bgColor="#FFFFFF"
              fgColor="#0A66C2"
              size={208}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              value={linkedInUrl}
              viewBox="0 0 256 256"
            />
          </div>
          <Link
            className="font-medium text-primary text-sm underline-offset-2 hover:underline"
            href={linkedInUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Open LinkedIn
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
