import Image from "next/image";
import Pill from "@/components/base/pill";

interface FlipPhotoProps {
	conferencePhoto: string;
	catPhoto: string;
	className?: string;
}

export default function FlipPhoto({
	conferencePhoto,
	catPhoto,
	className = "",
}: FlipPhotoProps) {
	return (
		<div className={`relative ${className}`}>
			<div className="flip-card size-12 md:size-60">
				<div className="flip-card-inner flip-card-auto">
					{/* Front - Conference Photo */}
					<div className="flip-card-front">
						<Image
							alt="Speaking at Next.js Conf London"
							className="rounded-full border-2 border-gray-200 object-cover object-top shadow-md transition-colors duration-200 hover:border-violet-500"
							fill
							priority
							quality={100}
							sizes="(min-width: 768px) 240px, 48px"
							src={conferencePhoto}
						/>
					</div>
					{/* Back - Cat Photo */}
					<div className="flip-card-back">
						<Image
							alt="My cat Kibby"
							className="rounded-full border-2 border-gray-200 object-cover object-top shadow-md transition-colors duration-200 hover:border-violet-500"
							fill
							quality={100}
							sizes="(min-width: 768px) 240px, 48px"
							src={catPhoto}
						/>
					</div>
				</div>
			</div>

			{/* Pill visibility driven by CSS animation synced to flip cycle */}
			<Pill className="top-5 left-[3.5px] hidden flip-pill -rotate-40 md:block">
				MY CAT 🐱
			</Pill>
		</div>
	);
}
