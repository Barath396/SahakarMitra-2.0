/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Search, BookOpen, ChevronRight } from 'lucide-react';
import { RetrievedSection } from '../types';
import { fetchActSections } from '../lib/api_client';

interface ActSectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: RetrievedSection) => void;
}

export const ActSectionsModal: React.FC<ActSectionsModalProps> = ({
  isOpen,
  onClose,
  onSelectSection,
}) => {
  const [sections, setSections] = useState<RetrievedSection[]>([]);
  const [search, setSearch] = useState('');
  const [selectedSection, setSelectedSection] = useState<RetrievedSection | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && sections.length === 0) {
      setLoading(true);
      fetchActSections()
        .then((items) => {
          if (items && items.length > 0) {
            setSections(items);
            setSelectedSection(items[0]);
          }
        })
        .catch((err) => {
          console.error('Error fetching sections:', err);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, sections.length]);

  if (!isOpen) return null;

  const filtered = sections.filter(
    (s) =>
      s.section.toLowerCase().includes(search.toLowerCase()) ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.chapter.toLowerCase().includes(search.toLowerCase()) ||
      (s.text && s.text.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-emerald-950/80 text-[#0C447C] dark:text-emerald-400 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Tamil Nadu Co-operative Societies Act, 1983
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Grounding Knowledge Base ({sections.length} statutory sections indexed)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search sections by number, keyword, or chapter (e.g. 32, audit, 87, election)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Section List */}
          <div className="w-1/3 border-r border-slate-200 dark:border-slate-800 overflow-y-auto p-2 space-y-1 bg-slate-50/30 dark:bg-slate-900/50">
            {loading ? (
              <div className="p-4 text-xs text-center text-slate-400">Loading statutory index...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-xs text-center text-slate-400">No matching sections found.</div>
            ) : (
              filtered.map((sec) => (
                <button
                  key={sec.section}
                  onClick={() => setSelectedSection(sec)}
                  className={`w-full text-left p-2.5 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-between ${
                    selectedSection?.section === sec.section
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-semibold'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="truncate pr-2">
                    <div className="font-bold text-slate-900 dark:text-white">Section {sec.section}</div>
                    <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{sec.title}</div>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Section Detail Viewer */}
          <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900 space-y-4">
            {selectedSection ? (
              <div className="space-y-4">
                <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-1.5 border border-emerald-200 dark:border-emerald-800">
                    Section {selectedSection.section}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedSection.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{selectedSection.chapter}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Statutory Legal Text
                  </h4>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedSection.text || (selectedSection as any).preview}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                  <button
                    onClick={() => {
                      onSelectSection(selectedSection);
                      onClose();
                    }}
                    className="px-4 py-2 bg-[#0C447C] dark:bg-emerald-600 hover:bg-blue-800 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Ask SahakarMitra about Section {selectedSection.section}
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                Select a section from the left column to view statutory details.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
