/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, Users, FileCheck, UserX, ShieldAlert, Landmark, Scale, Briefcase } from 'lucide-react';

interface QuickPromptsProps {
  onSelectPrompt: (prompt: string) => void;
  disabled?: boolean;
}

const SAMPLE_PROMPTS = [
  {
    icon: Calendar,
    label: 'பொதுக்குழு கூட்டம் (AGM Timeline)',
    query: 'பொதுக்குழு எப்போது கூட்ட வேண்டும்? நிதியாண்டு முடிந்த எத்தனை மாதத்திற்குள் நடத்த வேண்டும்?',
  },
  {
    icon: Users,
    label: 'நிர்வாகக்குழு தேர்தல் (Board Election)',
    query: 'இயக்குநர் குழு தேர்தல் எப்படி நடக்கும்? பதவிக்காலம் எத்தனை ஆண்டுகள் மற்றும் இடஒதுக்கீடு என்ன?',
  },
  {
    icon: UserX,
    label: 'உறுப்பினர் நீக்கம் (Expulsion)',
    query: 'சங்க நலனுக்கு எதிராக செயல்படும் உறுப்பினரை எப்படி நீக்கலாம்? எத்தனை பங்கு பெரும்பான்மை தேவை?',
  },
  {
    icon: FileCheck,
    label: 'கணக்கு தணிக்கை (Annual Audit)',
    query: 'கூட்டுறவு சங்க கணக்கு தணிக்கை எத்தனை மாதத்திற்குள் முடிக்கப்பட்டு அறிக்கை சமர்ப்பிக்கப்பட வேண்டும்?',
  },
  {
    icon: Landmark,
    label: 'பயிர்க்கடன் & நில உரிமை (PACS Crop Charge)',
    query: 'விவசாய கடன் அல்லது பயிர்க்கடன் பெற்றால் நிலம் மற்றும் பயிர்கள் மீது சங்கத்திற்கு என்ன உரிமை உண்டு?',
  },
  {
    icon: ShieldAlert,
    label: 'சர்சார்ஜ் முறைகேடு மீட்பு (Surcharge)',
    query: 'சங்கத்தில் நிதி முறைகேடு அல்லது இழப்பு ஏற்படுத்திய அலுவலரிடமிருந்து பணத்தை மீட்பது எப்படி?',
  },
  {
    icon: Scale,
    label: 'சங்க தகராறுகள் (Disputes Arbitration)',
    query: 'சங்க விவகாரங்கள் மற்றும் உறுப்பினர் தகராறுகளுக்கு சிவில் நீதிமன்றம் செல்ல முடியுமா அல்லது பதிவாளர் தீர்ப்பா?',
  },
  {
    icon: Briefcase,
    label: 'சம்பள பிடித்தம் (Salary Deduction)',
    query: 'உறுப்பினர் பெற்ற கடனை அவரது சம்பளத்தில் பிடித்தம் செய்து சங்கத்திற்கு செலுத்த வேலை அளிப்பவருக்கு கடமை உண்டா?',
  },
];

export const QuickPrompts: React.FC<QuickPromptsProps> = ({ onSelectPrompt, disabled }) => {
  return (
    <div className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-2.5 overflow-x-auto scrollbar-none transition-colors">
      <div className="max-w-6xl mx-auto flex items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          முக்கிய தலைப்புகள்:
        </span>
        <div className="flex items-center gap-2 min-w-max">
          {SAMPLE_PROMPTS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                disabled={disabled}
                onClick={() => onSelectPrompt(item.query)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title={item.query}
              >
                <Icon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
