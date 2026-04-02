import { cacheLife } from "next/cache";
import ScrollingBanner from "@/components/banner";
import Experience from "@/components/experience";
import Hero from "@/components/hero";
import OSSActivity from "@/components/oss-activity";
import Profile from "@/components/profile";
import Projects from "@/components/projects";
import ThemeSwitcher from "@/components/theme-switcher";
import { personConfig } from "@/lib/site-config";

export default async function Home() {
  "use cache";
  cacheLife("hours");
  const githubUrl = personConfig.sameAs.find((url) => url.includes("github.com/"));
  const githubUsername = githubUrl?.split("/").at(-1) ?? "";

  return (
    <>
      <div className="flex w-full flex-row gap-4">
        <ScrollingBanner />
        <ThemeSwitcher />
      </div>
      <div className="md:hidden">
        <Profile />
      </div>
      <Hero />
      <Experience />
      {githubUsername ? (
        <div className="md:hidden">
          <OSSActivity username={githubUsername} />
        </div>
      ) : null}
      <Projects />
    </>
  );
}
