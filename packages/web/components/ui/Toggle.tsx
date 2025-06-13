import { motion, useCycle } from "motion/react";

const transition = {
	type: "spring",
	stiffness: 400,
	damping: 17,
};

export function Toggle() {
	const [current, cycle] = useCycle("off", "on");

	return (
		<div className="">
			<motion.div
				className="relative h-8 w-12 cursor-pointer rounded-full bg-gray-800"
				animate={current}
				initial={false}
				onTapStart={() => cycle()}
			>
				<motion.div
					className="w=full h-full rounded-full bg-purple-700"
					variants={{ off: { scale: 0 }, on: { scale: 1 } }}
					transition={transition}
				/>
				<motion.div
					className="h-7 w-7 rounded-full bg-white shadow-md"
					style={{
						position: "absolute",
						top: 2,
						left: 2,
					}}
					variants={{ off: { x: 0 }, on: { x: 20 } }}
					transition={transition}
				/>
			</motion.div>
		</div>
	);
}
