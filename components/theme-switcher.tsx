"use client";

import { Card, CardContent } from "./base/card";
import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { useTheme } from "next-themes";

export default function ThemeSwitcher() {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<button
			aria-label="Toggle theme"
			onClick={() =>
				setTheme(resolvedTheme === "dark" ? "light" : "dark")
			}
			type="button"
		>
			<Card className="aspect-square h-14 transition-[background-color] duration-150 ease hover:bg-violet-50 active:scale-[0.97] dark:hover:bg-violet-500">
				<CardContent className="flex h-full w-full items-center justify-center p-0">
					<RiMoonLine className="size-4 dark:hidden" />
					<RiSunLine className="hidden size-4 dark:block" />
				</CardContent>
			</Card>
		</button>
	);
}
