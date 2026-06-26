const css = `
:root,.dark{--background:140 9% 11%;--foreground:50 18% 95%;--border:40 11% 83%;--card:50 18% 95%;--card-foreground:0 0% 12%;--card-border:40 11% 83%;--sidebar:140 9% 11%;--sidebar-foreground:50 18% 95%;--sidebar-border:0 0% 100% / 0.1;--sidebar-primary:149 33% 36%;--sidebar-primary-foreground:0 0% 100%;--sidebar-accent:0 0% 100% / 0.08;--sidebar-accent-foreground:50 18% 95%;--sidebar-ring:149 33% 36%;--popover:50 18% 95%;--popover-foreground:0 0% 12%;--popover-border:40 11% 83%;--primary:149 33% 36%;--primary-foreground:0 0% 100%;--secondary:48 16% 91%;--secondary-foreground:0 0% 15%;--muted:48 16% 91%;--muted-foreground:96 4% 42%;--accent:48 16% 91%;--accent-foreground:0 0% 12%;--input:40 11% 83%;--ring:149 33% 36%;--elevate-1:transparent;--elevate-2:transparent;--shadow-2xs:none;--shadow-xs:none;--shadow-sm:none;--shadow:none;--shadow-md:none;--shadow-lg:none;--shadow-xl:none;--shadow-2xl:none}
.signal-app .bg-red-50,.signal-app .bg-blue-50,.signal-app .bg-green-50,.signal-app .bg-orange-50,.signal-app .bg-violet-50{background-color:#eceae4!important}
.signal-app .border-red-200,.signal-app .border-blue-200,.signal-app .border-green-200,.signal-app .border-orange-200,.signal-app .border-violet-200{border-color:#d8d5ce!important}
.signal-app .text-red-500,.signal-app .text-red-700,.signal-app .text-blue-500,.signal-app .text-blue-700,.signal-app .text-green-600,.signal-app .text-green-700,.signal-app .text-orange-500,.signal-app .text-orange-700,.signal-app .text-violet-500,.signal-app .text-violet-700{color:#6b7068!important}
`;

if (typeof document !== "undefined") {
  const id = "signal87-theme-cleanup";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
}

export {};
