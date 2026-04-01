import { SidebarClient } from "./sidebar-client";
import ThemeSwitcher from "./theme-switcher";

export function Sidebar({
	profile,
	secondary,
}: {
	profile: React.ReactNode;
	secondary?: React.ReactNode;
}) {
	return (
		<SidebarClient
			themeSwitcher={<ThemeSwitcher />}
			profile={profile}
			secondary={secondary}
		/>
	);
}
