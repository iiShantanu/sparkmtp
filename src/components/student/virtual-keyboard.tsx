import { useEffect, useRef, useState } from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { Keyboard as KeyboardIcon, X } from "lucide-react";

/**
 * On-screen keyboard for touch kiosks (e.g. Raspberry Pi + Chromium) where the
 * OS does not summon a virtual keyboard automatically. Mounts once at the page
 * level; auto-opens when any <input type="text|email|password|search|url"> or
 * <textarea> gains focus, and types into that element.
 */
export function VirtualKeyboard() {
  const [open, setOpen] = useState(false);
  const [layout, setLayout] = useState<"default" | "shift" | "symbols">("default");
  const targetRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const keyboardRef = useRef<any>(null);

  const isTypable = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement => {
    if (!el) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.tagName !== "INPUT") return false;
    const t = (el as HTMLInputElement).type;
    return ["text", "email", "password", "search", "url", "tel", "number", ""].includes(t);
  };

  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as Element | null;
      if (!isTypable(t)) return;
      // Don't hijack inputs that explicitly opt out
      if ((t as HTMLElement).dataset?.noOsk === "true") return;
      targetRef.current = t as HTMLInputElement | HTMLTextAreaElement;
      keyboardRef.current?.setInput(targetRef.current.value || "");
      setOpen(true);
    };
    const onFocusOut = (e: FocusEvent) => {
      // Keep keyboard open if focus moves into the keyboard itself
      const next = e.relatedTarget as Element | null;
      if (next && (next.closest?.(".spark-osk") as Element | null)) return;
      // Small delay so taps on keyboard keys don't immediately close it
      setTimeout(() => {
        const active = document.activeElement;
        if (!isTypable(active)) {
          setOpen(false);
          targetRef.current = null;
        }
      }, 100);
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, []);

  const writeToTarget = (value: string) => {
    const el = targetRef.current;
    if (!el) return;
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const onChange = (value: string) => {
    writeToTarget(value);
  };

  const onKeyPress = (button: string) => {
    if (button === "{shift}" || button === "{lock}") {
      setLayout((l) => (l === "default" ? "shift" : "default"));
      return;
    }
    if (button === "{symbols}") {
      setLayout("symbols");
      return;
    }
    if (button === "{abc}") {
      setLayout("default");
      return;
    }
    if (button === "{enter}") {
      const el = targetRef.current;
      if (!el) return;
      if (el instanceof HTMLTextAreaElement) {
        const next = (el.value || "") + "\n";
        keyboardRef.current?.setInput(next);
        writeToTarget(next);
      } else {
        // Submit enclosing form, if any
        const form = el.closest("form");
        if (form) {
          if (typeof form.requestSubmit === "function") form.requestSubmit();
          else form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
        }
      }
      return;
    }
    if (layout === "shift") setLayout("default");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          // Open keyboard targeting the most recent typable element if any
          const active = document.activeElement;
          if (isTypable(active)) {
            targetRef.current = active as HTMLInputElement | HTMLTextAreaElement;
            keyboardRef.current?.setInput(targetRef.current.value || "");
            setOpen(true);
          }
        }}
        className="fixed bottom-3 right-3 z-[60] grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg"
        aria-label="Show keyboard"
      >
        <KeyboardIcon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className="spark-osk fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card shadow-2xl"
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => {
        // Prevent the focused input from blurring on tap
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Keyboard</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Hide keyboard"
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <Keyboard
        keyboardRef={(r) => (keyboardRef.current = r)}
        onChange={onChange}
        onKeyPress={onKeyPress}
        layoutName={layout}
        layout={{
          default: [
            "1 2 3 4 5 6 7 8 9 0 {bksp}",
            "q w e r t y u i o p",
            "a s d f g h j k l {enter}",
            "{shift} z x c v b n m , . ?",
            "{symbols} {space} -",
          ],
          shift: [
            "1 2 3 4 5 6 7 8 9 0 {bksp}",
            "Q W E R T Y U I O P",
            "A S D F G H J K L {enter}",
            "{shift} Z X C V B N M ! ' \"",
            "{symbols} {space} _",
          ],
          symbols: [
            "1 2 3 4 5 6 7 8 9 0 {bksp}",
            "@ # $ % & * ( ) / +",
            "- _ = ; : ' \" , . {enter}",
            "! ? ` ~ | \\ < > [ ]",
            "{abc} {space} .",
          ],
        }}
        display={{
          "{bksp}": "⌫",
          "{enter}": "⏎",
          "{shift}": "⇧",
          "{space}": "space",
          "{symbols}": "?123",
          "{abc}": "ABC",
        }}
        theme="hg-theme-default hg-layout-default spark-keyboard"
      />
    </div>
  );
}