// import HelloWord from "@/components/HelloWord";

import JoinGame from "@/components/JoinGame";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 px-4 py-4 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <header className="row-start-1">
        <div className="font-bold text-4xl tracking-tighter">
          <span className="">codenam</span>
          <span className=" text-gray-600">.</span>
          <span className="">es</span>
        </div>
        {/* <span className="">/ snazzy-squirrel</span> */}
      </header>
      <main className="flex flex-col gap-8 row-start-2 items-center sm:items-start">
        {/* <HelloWord /> */}
        <JoinGame />
      </main>
      <footer className="row-start-3 flex gap-6 flex-wrap items-center justify-center">
        <span className="text-2xl"></span>
      </footer>
    </div>
  );
}
