import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { GUIDES } from "@/lib/guides";

export function GuideCards({ exclude }: { exclude?: string }) {
  return (
    <div className="guide-cards">
      {GUIDES.filter((guide) => guide.slug !== exclude).map((guide) => (
        <article className="guide-card" key={guide.slug}>
          <Image
            src={guide.image}
            alt={guide.imageAlt}
            width={160}
            height={200}
            sizes="(max-width: 700px) 100px, 140px"
          />
          <div>
            <p className="eyebrow">PHOTO GUIDE</p>
            <h3>
              <Link href={`/guides/${guide.slug}`}>
                {guide.title}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </h3>
            <p>{guide.description}</p>
            <small>Image: AI-created style demonstration</small>
          </div>
        </article>
      ))}
    </div>
  );
}
