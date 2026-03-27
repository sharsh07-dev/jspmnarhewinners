import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* Animate a ref element fading up on scroll */
export const useFadeUp = (options = {}) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;
        gsap.fromTo(
            el,
            { opacity: 0, y: options.y ?? 40 },
            {
                opacity: 1,
                y: 0,
                duration: options.duration ?? 0.8,
                ease: "power3.out",
                delay: options.delay ?? 0,
                scrollTrigger: {
                    trigger: el,
                    start: "top 90%",
                    toggleActions: "play none none none",
                },
            }
        );
        return () => ScrollTrigger.getAll().forEach((t) => t.kill());
    }, []);
    return ref;
};

/* Stagger children  */
export const useStagger = (options = {}) => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) return;
        const children = ref.current.children;
        gsap.fromTo(
            children,
            { opacity: 0, y: options.y ?? 30 },
            {
                opacity: 1,
                y: 0,
                duration: options.duration ?? 0.6,
                stagger: options.stagger ?? 0.12,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: ref.current,
                    start: "top 88%",
                },
            }
        );
        return () => ScrollTrigger.getAll().forEach((t) => t.kill());
    }, []);
    return ref;
};

/* Hero entrance */
export const useHeroAnimation = () => {
    const ref = useRef(null);
    useEffect(() => {
        if (!ref.current) return;
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.fromTo(
            ref.current.querySelectorAll(".hero-anim"),
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 1, stagger: 0.15 }
        );
    }, []);
    return ref;
};
