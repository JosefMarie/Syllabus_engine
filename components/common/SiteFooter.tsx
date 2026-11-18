"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ArrowUpRight, ShieldCheck, LogIn, UserPlus, GraduationCap } from "lucide-react";

export default function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="glow-border mt-6 rounded-[28px] border border-[#2E2E34] bg-[#1C1C1F] p-6 sm:p-10 text-[#EAEAE6] shadow-2xl">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 pb-8 border-b border-[#2E2E34]">
        {/* Brand & Platform Description */}
        <div className="md:col-span-6 space-y-4">
          <div className="inline-flex items-center space-x-2.5 rounded-full bg-[#EAEAE6] text-[#141416] px-4 py-1.5 shadow-sm">
            <BookOpen className="h-4 w-4" />
            <span className="font-mono text-xs font-extrabold tracking-tight uppercase">
              Syllabus Engine
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight max-w-md leading-snug">
            Structured curriculum notes, assignments, and proctored assessments in one fast workspace.
          </h2>

          <p className="text-xs sm:text-sm text-[#A1A1AA] max-w-lg leading-relaxed">
            Built for technical and software development cohorts to master 5-level learning outcomes, collaborate in study groups, submit coursework on schedule, and complete secure online examinations.
          </p>
        </div>

        {/* Quick Links: Portals */}
        <div className="md:col-span-3 space-y-3">
          <span className="block text-[11px] font-mono font-bold uppercase tracking-widest text-[#71717A]">
            Portals &amp; Access
          </span>
          <ul className="space-y-2.5 text-xs font-semibold">
            <li>
              <Link href="/" className="inline-flex items-center space-x-2 text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                <GraduationCap className="h-3.5 w-3.5 text-[#A1A1AA]" />
                <span>Course Catalog</span>
              </Link>
            </li>
            <li>
              <Link href="/auth/login" prefetch={false} className="inline-flex items-center space-x-2 text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                <LogIn className="h-3.5 w-3.5 text-[#A1A1AA]" />
                <span>Student Login</span>
              </Link>
            </li>
            <li>
              <Link href="/auth/register" prefetch={false} className="inline-flex items-center space-x-2 text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                <UserPlus className="h-3.5 w-3.5 text-[#A1A1AA]" />
                <span>Register Student</span>
              </Link>
            </li>
            <li>
              <Link href="/admin" prefetch={false} className="inline-flex items-center space-x-2 text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                <ShieldCheck className="h-3.5 w-3.5 text-[#A1A1AA]" />
                <span>Teacher Admin Portal</span>
              </Link>
            </li>
          </ul>
        </div>

        {/* Quick Links: Resources */}
        <div className="md:col-span-3 space-y-3">
          <span className="block text-[11px] font-mono font-bold uppercase tracking-widest text-[#71717A]">
            Resources
          </span>
          <ul className="space-y-2.5 text-xs font-semibold">
            <li>
              <Link href="/tips" prefetch={false} className="text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                Developer Tips
              </Link>
            </li>
            <li>
              <Link href="/admin/login" prefetch={false} className="text-[#EAEAE6] hover:text-emerald-400 transition-colors">
                Instructor 2FA Sign In
              </Link>
            </li>
            <li>
              <a
                href="https://foundationea.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <span>foundationea.com</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Big "by foundationea.com" Display Row */}
      <div className="pt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none">
          <span className="text-[#71717A] mr-2 sm:mr-3">by</span>
          <a
            href="https://foundationea.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#EAEAE6] hover:text-emerald-400 underline decoration-[#2E2E34] hover:decoration-emerald-400 underline-offset-8 transition-all"
          >
            <span>foundationea.com</span>
            <ArrowUpRight className="h-7 w-7 sm:h-10 sm:w-10 shrink-0" />
          </a>
        </div>

        <p className="text-[11px] font-mono text-[#71717A]">
          &copy; {year} Syllabus Engine &bull; All rights reserved.
        </p>
      </div>
    </footer>
  );
}
