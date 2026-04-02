import { cacheLife } from "next/cache";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllExperience } from "@/lib/get-all-experience";
import { getExperience } from "@/lib/get-experience";
import Company from "./company";
import Details from "./details";
import Tech from "./tech";


export async function generateStaticParams() {
  const experiences = await getAllExperience();
  return experiences.map((e) => ({
    slug: e.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const experience = await getExperience(slug);

  if (!experience) {
    return {};
  }

  return {
    title: `${experience.role} at ${experience.company}`,
    description: experience.description,
    openGraph: {
      title: `${experience.role} at ${experience.company}`,
      description: experience.description,
    },
  };
}

export default async function ExperiencePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  "use cache";
  cacheLife("hours");

  const { slug } = await params;
  const experience = await getExperience(slug);

  if (!experience) {
    notFound();
  }

  return (
    <>
      <Company experience={experience} />
      <Tech experience={experience} />
      <Details experience={experience} />
    </>
  );
}
