import { Globe, Settings, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const steps = [
  {
    icon: Globe,
    title: "Paste your URL",
    desc: "Enter any website or web app URL you want to convert into an Android app.",
  },
  {
    icon: Settings,
    title: "Customize your app",
    desc: "Give your app a name and upload a custom icon to make it yours.",
  },
  {
    icon: Download,
    title: "Download & install",
    desc: "Get your APK file instantly. Install it on any Android device — no Play Store needed.",
  },
];

const HowItWorks = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.2 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground text-center text-balance mb-4">
          Three steps. That's it.
        </h2>
        <p className="text-muted-foreground text-center text-lg mb-16 max-w-xl mx-auto">
          No coding, no Android Studio, no complicated setup. Just your website URL.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`relative flex flex-col items-center text-center p-8 rounded-2xl bg-card border border-border/50 shadow-sm transition-all duration-700 ${
                visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: `${i * 100 + 100}ms`, filter: visible ? "blur(0)" : "blur(4px)" }}
            >
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <s.icon className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-semibold text-primary tracking-widest uppercase mb-2">
                Step {i + 1}
              </span>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
