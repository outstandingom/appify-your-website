import { Smartphone, ArrowDown } from "lucide-react";
import ConverterForm from "@/components/ConverterForm";
import HowItWorks from "@/components/HowItWorks";
import FAQ from "@/components/FAQ";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">WebToAPK</span>
        </div>
        <a
          href="#convert"
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Start converting →
        </a>
      </nav>

      {/* Hero */}
      <section className="hero-gradient py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h1
            className="font-display text-4xl md:text-6xl font-bold text-white leading-[1.08] text-balance animate-fade-up"
            style={{ opacity: 0 }}
          >
            Turn any website into an
            <br />
            <span className="text-primary">Android app</span>
          </h1>
          <p
            className="text-lg md:text-xl text-white/60 max-w-xl mx-auto leading-relaxed animate-fade-up"
            style={{ opacity: 0, animationDelay: "0.1s" }}
          >
            Paste your URL, add a name and icon — download a ready-to-install APK in seconds.
            No coding required.
          </p>
          <div
            className="pt-4 animate-fade-up"
            style={{ opacity: 0, animationDelay: "0.2s" }}
          >
            <a
              href="#convert"
              className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowDown className="w-4 h-4 animate-bounce" />
              Scroll to get started
            </a>
          </div>
        </div>
      </section>

      {/* Converter */}
      <section id="convert" className="py-20 px-6 bg-surface-sunken">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            Convert your website
          </h2>
          <p className="text-muted-foreground">
            Fill in the details below and we'll generate your APK instantly.
          </p>
        </div>
        <ConverterForm />
      </section>

      {/* How it works */}
      <HowItWorks />

      {/* FAQ */}
      <FAQ />

      {/* Footer */}
      <footer className="border-t border-border/50 py-10 px-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold text-sm text-foreground">WebToAPK</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} WebToAPK. Convert websites to Android apps instantly.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
