"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RiArrowLeftLine } from "@remixicon/react";
import { Card, CardContent } from "@/components/base/card";

export function SidebarClient({
	themeSwitcher,
	profile,
	secondary,
}: {
	themeSwitcher: React.ReactNode;
	profile: React.ReactNode;
	secondary?: React.ReactNode;
}) {
	const pathname = usePathname();
	const isHome = pathname === "/";

	return (
		<div className="space-y-6">
			{!isHome && (
				<div className="back-button-enter flex flex-row items-center justify-center gap-4">
					{themeSwitcher}
					<Card className="w-full transition-[background-color] duration-150 ease hover:bg-violet-50 active:scale-[0.98] dark:hover:bg-violet-500">
						<CardContent className="py-4">
							<Link
								className="flex flex-row items-center justify-center gap-2 font-medium"
								href="/"
								prefetch
							>
								<RiArrowLeftLine className="size-4" />
								Go Back
							</Link>
						</CardContent>
					</Card>
				</div>
			)}
			<div className={isHome ? "hidden md:block" : undefined}>
				{profile}
			</div>
			{secondary ? (
				<div className={isHome ? "hidden md:block" : undefined}>
					{secondary}
				</div>
			) : null}
		</div>
	);
}
