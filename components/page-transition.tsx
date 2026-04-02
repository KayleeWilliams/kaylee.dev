// ViewTransition is available in Next.js's bundled React but not yet in @types/react
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { ViewTransition } = require("react") as {
	ViewTransition: React.FC<{
		children: React.ReactNode;
		enter?: string;
		exit?: string;
		default?: string;
	}>;
};

export function PageTransition({ children }: { children: React.ReactNode }) {
	return (
		<ViewTransition enter="page-enter" exit="page-exit">
			{children}
		</ViewTransition>
	);
}
