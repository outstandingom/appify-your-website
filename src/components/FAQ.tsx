import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useEffect, useRef, useState } from "react";

const faqs = [
  {
    q: "How does website to APK conversion work?",
    a: "We wrap your website in a native Android WebView container, creating a lightweight APK that loads your site as a standalone app. It works just like a regular Android app on the user's phone.",
  },
  {
    q: "Do I need to know how to code?",
    a: "Not at all. Just paste your URL, choose an app name and icon, and we handle everything else. No Android Studio or coding knowledge required.",
  },
  {
    q: "Can I install the APK on any Android phone?",
    a: "Yes! The generated APK works on any Android device running Android 5.0 (Lollipop) or later. You'll need to enable 'Install from unknown sources' in your phone settings.",
  },
  {
    q: "Is the generated APK free to use?",
    a: "Yes, the basic conversion is completely free. You can generate and download as many APKs as you need.",
  },
  {
    q: "Will my app work offline?",
    a: "The app requires an internet connection to load your website content. If your website has offline capabilities (like a PWA), those will work within the app too.",
  },
];

const FAQ = () => {
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
    <section
      ref={ref}
      className={`py-24 px-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ filter: visible ? "blur(0)" : "blur(4px)" }}
    >
      <div className="max-w-2xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground text-center text-balance mb-12">
          Common questions
        </h2>
        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="bg-card border border-border/50 rounded-xl px-6 shadow-sm"
            >
              <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQ;
