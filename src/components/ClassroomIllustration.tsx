import React from "react";

export default function ClassroomIllustration() {
  return (
    <div className="w-full h-full min-h-[320px] md:min-h-[400px] bg-white rounded-2xl border border-slate-200/80 shadow-xl p-6 flex flex-col justify-between overflow-hidden relative group">
      {/* Decorative Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#1A237E] via-[#EF6C00] to-indigo-600" />
      
      {/* Visual Workspace Container */}
      <div className="flex-1 flex items-center justify-center">
        <svg 
          viewBox="0 0 800 600" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-full h-auto max-h-[380px]"
        >
          {/* Background Grid Accent */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#F1F5F9" strokeWidth="1" />
            </pattern>
            
            {/* Gradients for modern UI look */}
            <linearGradient id="teacherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1A237E" />
              <stop offset="100%" stopColor="#313BAC" />
            </linearGradient>
            
            <linearGradient id="studentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>

            <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#EF6C00" />
              <stop offset="100%" stopColor="#FF9800" />
            </linearGradient>

            <linearGradient id="glowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#EF6C00" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#EF6C00" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="signalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#EF6C00" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#1A237E" stopOpacity="0.8" />
            </linearGradient>
          </defs>

          {/* Draw Grid Background */}
          <rect width="800" height="600" fill="url(#grid)" rx="16" />

          {/* BACK WALL / ROOM LIMIT */}
          <line x1="50" y1="480" x2="750" y2="480" stroke="#E2E8F0" strokeWidth="3" strokeDasharray="6 6" />

          {/* ==================== TEACHER SECTION (LEFT/TOP) ==================== */}
          {/* Teacher Desk Shadow */}
          <ellipse cx="200" cy="240" rx="90" ry="15" fill="#E2E8F0" />
          
          {/* Teacher Desk */}
          <path d="M100 200 H300 V210 H100 V200 Z" fill="#94A3B8" /> {/* Table Top */}
          <rect x="120" y="210" width="15" height="40" fill="#64748B" /> {/* Leg Left */}
          <rect x="265" y="210" width="15" height="40" fill="#64748B" /> {/* Leg Right */}

          {/* Large Teacher Dashboard Monitor */}
          <rect x="150" y="130" width="100" height="60" rx="4" fill="#0F172A" stroke="#1A237E" strokeWidth="3" />
          <rect x="155" y="135" width="90" height="50" rx="2" fill="#1E293B" />
          <rect x="190" y="190" width="20" height="15" fill="#475569" /> {/* Stand */}
          <path d="M175 200 H225" stroke="#475569" strokeWidth="4" strokeLinecap="round" />

          {/* Miniature charts on Teacher Monitor */}
          <circle cx="175" cy="150" r="8" fill="#EF6C00" opacity="0.8" />
          <rect x="192" y="145" width="18" height="4" rx="1" fill="#3B82F6" />
          <rect x="192" y="152" width="28" height="4" rx="1" fill="#10B981" />
          <rect x="192" y="159" width="38" height="4" rx="1" fill="#64748B" />
          
          <rect x="165" y="170" width="15" height="10" rx="1" fill="#10B981" opacity="0.3" />
          <rect x="185" y="170" width="15" height="10" rx="1" fill="#EF6C00" opacity="0.3" />
          <rect x="205" y="170" width="15" height="10" rx="1" fill="#3B82F6" opacity="0.3" />
          <rect x="225" y="170" width="15" height="10" rx="1" fill="#10B981" opacity="0.3" />

          {/* Laptop on desk */}
          <path d="M250 185 L280 185 L285 198 L245 198 Z" fill="#CBD5E1" />
          <rect x="252" y="172" width="24" height="15" rx="1" fill="#334155" />
          
          {/* Teacher Sitting */}
          {/* Chair backrest */}
          <rect x="185" y="205" width="30" height="35" rx="4" fill="#1A237E" opacity="0.8" />
          
          {/* Teacher Figure */}
          <circle cx="200" cy="180" r="16" fill="#FDBA74" /> {/* Head */}
          <path d="M175 220 C175 198 225 198 225 220" fill="url(#teacherGrad)" /> {/* Body */}
          {/* Glasses representation */}
          <rect x="192" y="176" width="7" height="4" rx="1" stroke="#1E293B" strokeWidth="1.5" />
          <rect x="201" y="176" width="7" height="4" rx="1" stroke="#1E293B" strokeWidth="1.5" />
          <line x1="199" y1="178" x2="201" y2="178" stroke="#1E293B" />
          {/* Teacher hair/style */}
          <path d="M184 174 C184 162 216 162 216 174" fill="#1E293B" />

          {/* ==================== STUDENTS ROW 1 (MIDDLE/FOREGROUND) ==================== */}
          {/* Row 1 Desk Shadow */}
          <ellipse cx="500" cy="430" rx="190" ry="25" fill="#E2E8F0" />

          {/* Row 1 Student Desks (Shared Bench) */}
          <rect x="330" y="375" width="340" height="15" rx="2" fill="#E2E8F0" stroke="#CBD5E1" strokeWidth="2" />
          <rect x="360" y="390" width="16" height="55" fill="#94A3B8" />
          <rect x="620" y="390" width="16" height="55" fill="#94A3B8" />

          {/* Student 1 (Left of Bench) - "Codificando" */}
          {/* Student Body */}
          <circle cx="410" cy="340" r="15" fill="#FCA5A5" /> {/* Head */}
          <path d="M385 375 C385 355 435 355 435 375 Z" fill="#3B82F6" /> {/* Blue shirt */}
          {/* Hair */}
          <path d="M395 332 C395 320 425 320 425 332" fill="#475569" />
          {/* Student computer */}
          <rect x="385" y="300" width="50" height="35" rx="3" fill="#1E293B" stroke="#3B82F6" strokeWidth="2.5" />
          {/* Screen Content - Lines of Code */}
          <rect x="390" y="304" width="40" height="2" fill="#10B981" />
          <rect x="390" y="309" width="25" height="2" fill="#F59E0B" />
          <rect x="390" y="314" width="35" height="2" fill="#3B82F6" />
          <rect x="390" y="319" width="15" height="2" fill="#10B981" />
          <rect x="390" y="324" width="30" height="2" fill="#64748B" />
          
          <rect x="405" y="335" width="10" height="15" fill="#475569" />
          <ellipse cx="410" cy="350" rx="15" ry="3" fill="#475569" />
          {/* Glowing Status badge floating over student 1 */}
          <g className="animate-pulse">
            <circle cx="410" cy="275" r="12" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="2" />
            <path d="M406 275 L409 278 L415 272" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>

          {/* Student 2 (Right of Bench) - "Preciso de Ajuda" */}
          {/* Student Body */}
          <circle cx="590" cy="340" r="15" fill="#FED7AA" /> {/* Head */}
          <path d="M565 375 C565 355 615 355 615 375 Z" fill="url(#orangeGrad)" /> {/* Orange shirt */}
          {/* Hair */}
          <path d="M578 335 C575 322 605 322 602 335" fill="#78350F" />
          {/* Hand raised for help */}
          <path d="M610 375 L630 325 C632 320 638 322 636 328 L615 375" fill="#FED7AA" stroke="#D97706" strokeWidth="1" />
          
          {/* Student computer */}
          <rect x="565" y="300" width="50" height="35" rx="3" fill="#1E293B" stroke="#EF6C00" strokeWidth="2.5" />
          {/* Screen Content - Red lines indicating bugs */}
          <rect x="570" y="304" width="40" height="2" fill="#EF4444" />
          <rect x="570" y="309" width="35" height="2" fill="#EF4444" />
          <rect x="570" y="314" width="20" height="2" fill="#64748B" />
          <rect x="570" y="319" width="10" height="2" fill="#EF6C00" />
          
          <rect x="585" y="335" width="10" height="15" fill="#475569" />
          <ellipse cx="590" cy="350" rx="15" ry="3" fill="#475569" />
          {/* Raised Help Alert Sign above student 2 */}
          <g className="animate-bounce">
            <circle cx="590" cy="272" r="14" fill="#FFF7ED" stroke="#EF6C00" strokeWidth="2.5" />
            <text x="590" y="277" fontFamily="sans-serif" fontSize="15" fontWeight="900" fill="#EF6C00" textAnchor="middle">?</text>
          </g>


          {/* ==================== STUDENTS ROW 2 (BACKGROUND / BACKBENCH) ==================== */}
          {/* Row 2 Desk Shadow */}
          <ellipse cx="530" cy="290" rx="150" ry="18" fill="#E2E8F0" opacity="0.8" />

          {/* Row 2 Student Desk */}
          <rect x="390" y="250" width="280" height="12" rx="2" fill="#F1F5F9" stroke="#E2E8F0" strokeWidth="1.5" />
          <rect x="420" y="262" width="12" height="40" fill="#94A3B8" opacity="0.8" />
          <rect x="630" y="262" width="12" height="40" fill="#94A3B8" opacity="0.8" />

          {/* Student 3 (Row 2, Left) - "Concluído" */}
          <circle cx="460" cy="225" r="12" fill="#C1A3F1" /> {/* Head */}
          <path d="M440 250 C440 234 480 234 480 250 Z" fill="#10B981" /> {/* Green shirt */}
          {/* Hair */}
          <path d="M448 221 C448 210 472 210 472 221" fill="#1E293B" />
          {/* Computer */}
          <rect x="440" y="195" width="40" height="28" rx="2" fill="#1E293B" stroke="#10B981" strokeWidth="2" />
          <rect x="445" y="199" width="30" height="16" fill="#0F172A" />
          <rect x="448" y="204" width="24" height="6" fill="#10B981" opacity="0.8" />
          
          <rect x="456" y="223" width="8" height="10" fill="#475569" />
          <ellipse cx="460" cy="233" rx="10" ry="2" fill="#475569" />
          {/* Floating success badge */}
          <circle cx="460" cy="177" r="10" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.5" />
          <path d="M457 177 L459 179 L463 175" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Student 4 (Row 2, Right) - "Pausado" */}
          <circle cx="580" cy="225" r="12" fill="#FDE047" /> {/* Head */}
          <path d="M560 250 C560 234 600 234 600 250 Z" fill="#64748B" /> {/* Gray shirt */}
          {/* Hair */}
          <circle cx="580" cy="216" r="4" fill="#451A03" />
          {/* Computer */}
          <rect x="560" y="195" width="40" height="28" rx="2" fill="#334155" stroke="#94A3B8" strokeWidth="1.5" />
          <rect x="565" y="199" width="30" height="16" fill="#1E293B" />
          <line x1="575" y1="207" x2="585" y2="207" stroke="#94A3B8" strokeWidth="2" /> {/* Pause symbol on screen */}
          
          <rect x="576" y="223" width="8" height="10" fill="#475569" />
          <ellipse cx="580" cy="233" rx="10" ry="2" fill="#475569" />


          {/* ==================== THE REAL-TIME SYNC LINES ==================== */}
          {/* Curves representing real-time telemetry from student computers to teacher dashboard */}
          
          {/* Line from Student 1 (Codificando) to Teacher Monitor */}
          <path 
            d="M410 300 C300 250 250 200 210 185" 
            stroke="#3B82F6" 
            strokeWidth="3" 
            strokeDasharray="8 6" 
            strokeLinecap="round" 
            opacity="0.6"
            className="animate-[dash_10s_linear_infinite]"
          />
          
          {/* Line from Student 2 (Need Help) to Teacher Monitor */}
          <path 
            d="M590 300 C500 180 320 180 230 170" 
            stroke="#EF6C00" 
            strokeWidth="3.5" 
            strokeDasharray="6 4" 
            strokeLinecap="round" 
            opacity="0.85"
            className="animate-[dash_8s_linear_infinite]"
          />

          {/* Line from Student 3 (Concluido) to Teacher Monitor */}
          <path 
            d="M460 195 C380 150 280 150 240 155" 
            stroke="#10B981" 
            strokeWidth="2" 
            strokeDasharray="10 8" 
            strokeLinecap="round" 
            opacity="0.5"
          />

          {/* Glowing telemetry dots flying along the paths */}
          <circle cx="310" cy="235" r="5" fill="#3B82F6" opacity="0.8">
            <animateMotion 
              path="M410 300 C300 250 250 200 210 185" 
              dur="4s" 
              repeatCount="indefinite" 
            />
          </circle>

          <circle cx="450" cy="175" r="6" fill="#EF6C00" opacity="0.9">
            <animateMotion 
              path="M590 300 C500 180 320 180 230 170" 
              dur="3s" 
              repeatCount="indefinite" 
            />
          </circle>

          {/* Labels & Legends on image */}
          <g transform="translate(60, 520)" opacity="0.8">
            {/* Legend Box */}
            <rect x="0" y="0" width="680" height="50" rx="8" fill="#F8FAFC" stroke="#E2E8F0" />
            
            <circle cx="30" cy="25" r="5" fill="#3B82F6" />
            <text x="42" y="29" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#475569">Dados de Progresso</text>
            
            <circle cx="210" cy="25" r="5" fill="#EF6C00" />
            <text x="222" y="29" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#475569">Chamados de Dúvida</text>

            <circle cx="400" cy="25" r="5" fill="#10B981" />
            <text x="412" y="29" fontFamily="sans-serif" fontSize="11" fontWeight="bold" fill="#475569">Tarefa Concluída</text>

            <text x="590" y="29" fontFamily="monospace" fontSize="10" fontWeight="bold" fill="#94A3B8">Telemetry: ACTIVE</text>
          </g>

        </svg>
      </div>

      {/* Caption footer */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 flex items-center justify-between text-[11px] text-slate-500 mt-4 font-sans">
        <span className="flex items-center gap-1.5 font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Monitoramento de Bancadas do Laboratório ETE</span>
        </span>
        <span className="text-slate-400 font-mono font-bold">Sala de Aula Integrada v1.2</span>
      </div>
    </div>
  );
}
