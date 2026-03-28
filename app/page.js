"use client";

import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { ApifyClient } from "apify-client";
import {
  FaSearch,
  FaMapMarkerAlt,
  FaGlobe,
  FaBuilding,
  FaFilter,
  FaLeaf,
  FaAward,
  FaTimes,
  FaCheckSquare,
  FaRegSquare,
  FaArrowLeft,
  FaEnvelope,
  FaPhone,
  FaIndustry,
  FaTh,
  FaMapMarkedAlt,
} from "react-icons/fa";
import { FaScaleBalanced } from "react-icons/fa6";
import { BsStars, BsShieldCheck, BsBoxSeam } from "react-icons/bs";
import CompanyIntelligenceCard from "@/app/components/CompanyIntelligenceCard";
import ContactSupplierModal from "@/app/components/ContactSupplierModal";
import { rankSuppliers } from "@/lib/searchEngine";
import { normalizeExporterItem } from "@/lib/supplierNormalize";
import {
  findSimilarCompanies,
  deriveStrengths,
} from "@/lib/companyIntelligence";
import { matchesRevenueBand } from "@/lib/companyMetrics";

const SupplierMapView = dynamic(
  () => import("@/app/components/SupplierMapView"),
  { ssr: false, loading: () => <MapViewLoading /> },
);

function MapViewLoading() {
  return (
    <div className="w-full h-[min(70vh,520px)] min-h-[360px] rounded-2xl border border-slate-700 bg-slate-900/40 flex items-center justify-center text-slate-500 text-sm">
      Loading map…
    </div>
  );
}

const client = new ApifyClient({
  token: process.env.NEXT_PUBLIC_APIFY_TOKEN || "",
});

export default function SupplyChainIntelligence() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Advanced Filters
  const [locationFilter, setLocationFilter] = useState("");
  const [minEmployees, setMinEmployees] = useState("");
  const [esgCertified, setEsgCertified] = useState(false);
  const [isoCertified, setIsoCertified] = useState(false);
  const [revenueFilter, setRevenueFilter] = useState("any");
  const [maxEmployees, setMaxEmployees] = useState("");
  const [minYearsActive, setMinYearsActive] = useState("");

  // Comparison & View State
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [compareModalTab, setCompareModalTab] = useState("scores");
  const [resultsView, setResultsView] = useState("grid");

  // Navigation State
  const [activeSupplierProfile, setActiveSupplierProfile] = useState(null);
  const [savedScrollPos, setSavedScrollPos] = useState(0); // 🔥 New state for scroll tracking

  // Contact Modal State
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [contactModalCompany, setContactModalCompany] = useState(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 🔥 Smart Routing Handlers
  const handleOpenProfile = (supplier) => {
    // Only save the scroll position if we are coming from the main search page
    if (!activeSupplierProfile) {
      setSavedScrollPos(window.scrollY);
    }
    setActiveSupplierProfile(supplier);
    // Instantly snap to the top of the new page
    window.scrollTo({ top: 0, behavior: "instant" });
  };

  const handleCloseProfile = () => {
    setActiveSupplierProfile(null);
    // Use a tiny timeout to wait for the Search Results DOM to physically render before scrolling
    setTimeout(() => {
      window.scrollTo({ top: savedScrollPos, behavior: "instant" });
    }, 10);
  };

  const fetchSuppliers = async () => {
    if (!query) return;
    setLoading(true);
    setHasSearched(true);
    setSelectedForCompare([]);
    setActiveSupplierProfile(null);
    setResultsView("grid");

    try {
      const input = { query, mode: "all", maxResults: 12 };

      const run = await client
        .actor("zen-studio/thomasnet-suppliers-scraper")
        .call(input, { waitSecs: 15 });

      let items = [];

      if (run.status === "SUCCEEDED") {
        const dataset = client.dataset(run.defaultDatasetId);
        const data = await dataset.listItems({ limit: 12 });
        items = data.items;
      }

      // Expanded Hackathon Fallback Data
      if (items.length === 0) {
        console.log("Using Expanded Hackathon Fallback Data...");
        items = [
          {
            name: "EcoValve Manufacturing Co.",
            website: "https://www.ecovalve-mfg.com",
            description:
              "Leading manufacturer of sustainable, heavy-duty industrial valves for the oil, gas, and water treatment sectors. We prioritize recycled steel and zero-emission forging processes.",
            address: { city: "Houston", stateName: "Texas", country: "USA" },
            headings: ["Fluid Control", "Heavy Industry", "Sustainable Tech"],
            brands: ["EcoValve", "SteelForge", "AquaFlow"],
            annualSales: "$10M - $25M",
            numberEmployees: "150",
            yearFounded: "1998",
            categories: ["Fluid Control", "Heavy Industry", "Sustainable Tech"],
            products: [
              "Industrial Valves",
              "Pipe Fittings",
              "CNC Machining",
              "Pressure Regulators",
            ],
            certifications: ["ISO 9001", "LEED Gold", "API Spec 6D"],
          },
          {
            name: "Nexus Precision Parts",
            website: "https://www.nexusprecision.com",
            description:
              "High-tolerance precision parts and custom tooling. ISO 9001 certified and specializing in aerospace and medical device components. 5-axis CNC capabilities.",
            address: {
              city: "San Jose",
              stateName: "California",
              country: "USA",
            },
            headings: ["Aerospace", "Medical Devices", "Precision Machining"],
            brands: ["Nexus Aero", "MedCore"],
            annualSales: "$50M+",
            numberEmployees: "320",
            yearFounded: "2005",
            categories: ["Aerospace", "Medical Devices", "Precision Machining"],
            products: [
              "Titanium Implants",
              "Turbine Blades",
              "Custom Tooling",
              "Micro-machined gears",
            ],
            certifications: ["ISO 9001", "AS9100 Rev D", "ISO 13485"],
          },
          {
            name: "Midwest Packaging Solutions",
            website: "https://www.midwestpacksolutions.com",
            description:
              "Bulk corrugated packaging and sustainable shipping materials. 100% powered by renewable energy. Custom structural design and rapid prototyping available.",
            address: { city: "Chicago", stateName: "Illinois", country: "USA" },
            headings: ["Packaging", "Logistics Supply", "Green Materials"],
            brands: ["Midwest Pack", "EcoShip"],
            annualSales: "$5M - $10M",
            numberEmployees: "45",
            yearFounded: "2012",
            categories: ["Packaging", "Logistics Supply", "Green Materials"],
            products: [
              "Corrugated Boxes",
              "Biodegradable Peanuts",
              "Custom Pallets",
              "Shrink Wrap",
            ],
            certifications: ["FSC Certified", "ISO 14001"],
          },
          {
            name: "Global Tech Circuits",
            website: "https://www.globaltechcircuits.com",
            description:
              "Tier 1 supplier of Printed Circuit Boards (PCBs) and electronic assemblies for automotive and consumer electronics. High-volume automated SMT lines.",
            address: { city: "Austin", stateName: "Texas", country: "USA" },
            headings: ["Electronics", "Semiconductors", "Automotive"],
            brands: ["GTC", "AutoCirc"],
            annualSales: "$100M+",
            numberEmployees: "850",
            yearFounded: "1992",
            categories: ["Electronics", "Semiconductors", "Automotive"],
            products: [
              "Multilayer PCBs",
              "Flexible Circuits",
              "SMT Assembly",
              "Testing Services",
            ],
            certifications: ["ISO 9001", "IATF 16949", "RoHS Compliant"],
          },
          {
            name: "Apex Polymer Solutions",
            website: "https://www.apexpolymers.net",
            description:
              "Custom plastic injection molding and synthetic polymer extrusion. Specializing in high-heat and chemically resistant plastics for industrial applications.",
            address: { city: "Akron", stateName: "Ohio", country: "USA" },
            headings: ["Plastics", "Chemicals", "Injection Molding"],
            brands: ["ApexPoly", "ThermoBlend"],
            annualSales: "$25M - $50M",
            numberEmployees: "210",
            yearFounded: "1985",
            categories: ["Plastics", "Chemicals", "Injection Molding"],
            products: [
              "Injection Molded Parts",
              "Polycarbonate Sheets",
              "Nylon Tubing",
              "Custom Resins",
            ],
            certifications: ["ISO 9001", "UL Registered Fabricator"],
          },
          {
            name: "Ironforge Heavy Industries",
            website: "https://www.ironforgeheavy.com",
            description:
              "Large scale metal casting and forging. Supplying the rail, defense, and construction sectors with structural steel components up to 50 tons.",
            address: {
              city: "Pittsburgh",
              stateName: "Pennsylvania",
              country: "USA",
            },
            headings: ["Metallurgy", "Defense", "Construction"],
            brands: ["Ironforge", "RailPro"],
            annualSales: "$75M+",
            numberEmployees: "400",
            yearFounded: "1920",
            categories: ["Metallurgy", "Defense", "Construction"],
            products: [
              "Steel Castings",
              "Forged Shafts",
              "Structural Beams",
              "Rail Components",
            ],
            certifications: ["ISO 9001", "AAR M-1003", "NIST 800-171"],
          },
        ];
      }

      const processedSuppliers = items.map((s, index) =>
        normalizeExporterItem(s, index),
      );

      const rankedSuppliers = await rankSuppliers(processedSuppliers, query, {
        searchMode: "expanded",
        semanticWeight: 0.6,
      });

      setSuppliers(rankedSuppliers);
    } catch (err) {
      console.error("Scraping failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (esgCertified && !s.isEsg) return false;
      if (isoCertified && !s.isIso) return false;
      if (
        locationFilter &&
        !s.address.toLowerCase().includes(locationFilter.toLowerCase())
      )
        return false;
      if (minEmployees && s.employees < parseInt(minEmployees, 10))
        return false;
      if (maxEmployees && s.employees > parseInt(maxEmployees, 10))
        return false;
      if (!matchesRevenueBand(s, revenueFilter)) return false;
      if (minYearsActive) {
        const minY = parseInt(minYearsActive, 10);
        if (
          s.yearsActive == null ||
          Number.isNaN(minY) ||
          s.yearsActive < minY
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    suppliers,
    esgCertified,
    isoCertified,
    locationFilter,
    minEmployees,
    maxEmployees,
    revenueFilter,
    minYearsActive,
  ]);

  const similarSuppliers = useMemo(() => {
    if (!activeSupplierProfile) return [];
    return findSimilarCompanies(activeSupplierProfile, suppliers, 5);
  }, [activeSupplierProfile, suppliers]);

  const toggleCompare = (supplier, e) => {
    e.stopPropagation();
    if (selectedForCompare.find((s) => s.id === supplier.id)) {
      setSelectedForCompare(
        selectedForCompare.filter((s) => s.id !== supplier.id),
      );
    } else if (selectedForCompare.length < 3) {
      setSelectedForCompare([...selectedForCompare, supplier]);
    }
  };

  if (activeSupplierProfile) {
    const s = activeSupplierProfile;
    const profileStrengths = deriveStrengths(s, s.fitBreakdown);
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans selection:bg-indigo-500/30">
        <nav className="border-b border-slate-800/60 bg-[#0a0f1a]/80 backdrop-blur-md p-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <button
              onClick={handleCloseProfile}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-medium bg-slate-800/50 hover:bg-slate-800 px-4 py-2 rounded-lg"
            >
              <FaArrowLeft /> Back to Search
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Import<span className="text-indigo-400 font-medium">.me</span>
              </h1>
            </div>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto p-6 space-y-8 mt-4 pb-24">
          <div className="bg-[#0d1321] border border-slate-700 rounded-2xl p-8 shadow-2xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-start">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="h-32 w-32 shrink-0 bg-white rounded-2xl flex items-center justify-center border border-slate-600 overflow-hidden shadow-inner p-2 relative z-10">
              {s.logoUrl ? (
                <img
                  src={s.logoUrl}
                  alt="logo"
                  className="object-contain w-full h-full"
                />
              ) : (
                <FaBuilding className="text-slate-300 h-16 w-16" />
              )}
            </div>

            <div className="flex-1 relative z-10">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-white">{s.name}</h1>
                <div className="flex flex-col items-end gap-1">
                  <div className="bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                    <BsStars className="h-4 w-4 text-indigo-400" />
                    <span className="text-sm font-bold text-indigo-300">
                      Fit score: {s.fitScore ?? 0}
                    </span>
                  </div>
                  <div className="w-36 h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                      style={{
                        width: `${Math.min(100, s.fitScore ?? 0)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 mb-6">
                <span className="flex items-center gap-1.5">
                  <FaMapMarkerAlt className="text-slate-500" /> {s.address}
                </span>
                <span className="flex items-center gap-1.5">
                  <FaGlobe className="text-slate-500" />{" "}
                  <a
                    href={s.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    {s.website}
                  </a>
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {s.categories.map((cat, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-medium text-slate-300 flex items-center gap-1.5"
                  >
                    <FaIndustry className="text-slate-500 h-3 w-3" /> {cat}
                  </span>
                ))}
              </div>
              {profileStrengths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {profileStrengths.map((line, i) => (
                    <span
                      key={i}
                      className="text-xs font-medium text-emerald-400/95 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full"
                    >
                      ✔ {line}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 w-full md:w-auto relative z-10">
              <button
                onClick={(e) => toggleCompare(s, e)}
                className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 border ${selectedForCompare.some((comp) => comp.id === s.id) ? "bg-indigo-600/20 border-indigo-500 text-indigo-400" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"}`}
              >
                {selectedForCompare.some((comp) => comp.id === s.id) ? (
                  <>
                    <FaCheckSquare /> In Compare
                  </>
                ) : (
                  <>
                    <FaRegSquare /> Add to Compare
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setContactModalCompany(s);
                  setIsContactModalOpen(true);
                }}
                className="px-6 py-3 bg-white text-slate-900 hover:bg-indigo-50 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <FaEnvelope className="text-indigo-600" /> Request Quote
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-8">
              <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">
                  Company Overview
                </h2>
                <p className="text-slate-400 leading-relaxed">
                  {s.description}
                </p>
              </div>

              {(s.tags?.length > 0 || s.brands?.length > 0) && (
                <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">
                    Tags & brands
                  </h2>
                  {s.tags?.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                        Extracted tags
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {s.tags.map((t, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/25 text-indigo-200 text-xs rounded-lg"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {s.brands?.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-2">
                        Brands
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {s.brands.slice(0, 5).map((b, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                  <BsBoxSeam className="text-indigo-400" /> Product Capabilities
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {s.products.length > 0 ? (
                    s.products.map((product, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-lg"
                      >
                        <div className="h-2 w-2 rounded-full bg-indigo-500"></div>
                        <span className="text-sm text-slate-300">
                          {product}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 italic text-sm">
                      No specific products listed.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                    Annual Revenue
                  </p>
                  <p className="text-white font-medium text-lg">
                    {s.annualSales}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                    Company Size
                  </p>
                  <p className="text-white font-medium text-lg">
                    {s.employeeString} Employees
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-1">
                    Year Founded
                  </p>
                  <p className="text-white font-medium text-lg">
                    {s.yearFounded}
                  </p>
                </div>
              </div>

              {s.fitBreakdown && (
                <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
                  <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                    Fit score breakdown
                  </h2>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Experience (40), size (30), brands (30).
                  </p>
                  {[
                    ["aiSemantic", "AI semantic match"],
                    ["experience", "Experience"],
                    ["size", "Company size"],
                    ["brands", "Brands"],
                  ].map(([key, label]) => {
                    const max =
                      key === "aiSemantic"
                        ? 100
                        : key === "experience"
                          ? 40
                          : 30;
                    const val = s.fitBreakdown[key] ?? 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span
                            className={
                              key === "aiSemantic"
                                ? "text-indigo-400 font-bold"
                                : "text-slate-400"
                            }
                          >
                            {label}
                          </span>
                          <span
                            className={
                              key === "aiSemantic"
                                ? "text-white font-bold"
                                : "text-indigo-300 font-semibold"
                            }
                          >
                            {val}
                          </span>
                        </div>
                        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${key === "aiSemantic" ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-indigo-500/80"}`}
                            style={{
                              width: `${Math.min(100, (val / max) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                  Contact Details
                </h2>
                <div className="flex items-center gap-3 text-sm">
                  <div className="bg-slate-800 p-2 rounded flex items-center justify-center">
                    <FaPhone className="text-slate-400" />
                  </div>
                  <span className="text-slate-300">{s.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="bg-slate-800 p-2 rounded flex items-center justify-center">
                    <FaEnvelope className="text-slate-400" />
                  </div>
                  <span className="text-indigo-400">{s.email}</span>
                </div>
              </div>

              <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl">
                <h2 className="text-sm font-bold text-white border-b border-slate-800 pb-2 mb-4">
                  Compliance & Certifications
                </h2>
                <div className="flex flex-col gap-2">
                  {s.certifications.map((cert, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded border border-slate-700"
                    >
                      <FaAward className="text-yellow-500 h-4 w-4 shrink-0" />
                      <span className="text-sm text-slate-300 font-medium">
                        {cert}
                      </span>
                    </div>
                  ))}
                  {s.certifications.length === 0 && (
                    <span className="text-slate-500 text-sm">
                      No certifications found.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {similarSuppliers.length > 0 && (
            <div className="bg-[#0d1321] border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
                <BsStars className="text-indigo-400" /> Similar suppliers
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Ranked by overlapping categories, shared tags, and common
                brands.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {similarSuppliers.map(({ company: c, similarityScore }) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleOpenProfile(c)}
                    className="text-left p-4 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-indigo-500/40 transition-colors"
                  >
                    <div className="font-semibold text-white">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      Similarity rank score: {similarityScore}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <ContactSupplierModal
          company={contactModalCompany}
          open={isContactModalOpen}
          onClose={() => {
            setIsContactModalOpen(false);
            setContactModalCompany(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-slate-300 font-sans selection:bg-indigo-500/30 pb-24">
      <nav className="border-b border-slate-800/60 bg-[#0a0f1a]/80 backdrop-blur-md p-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
              <BsShieldCheck className="text-white h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Import<span className="text-indigo-400 font-medium">.me</span>
            </h1>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6 space-y-8 mt-4">
        <div className="bg-gradient-to-b from-slate-800/40 to-slate-900/20 border border-slate-700/50 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">
              <BsStars className="text-indigo-400" /> Industrial Sourcing Engine
            </h2>
            <p className="text-slate-400 mb-6 max-w-2xl text-sm leading-relaxed">
              Find B2B manufacturers and raw material suppliers. Describe your
              exact requirements—materials, compliance, volume, and location.
            </p>

            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 blur opacity-25 group-hover:opacity-40 transition-opacity"></div>
                <div className="relative flex items-center bg-[#0d1321] border border-slate-700 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors shadow-inner">
                  <FaSearch className="absolute left-4 text-indigo-400 h-4 w-4" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g., 'ISO certified valve manufacturers in Texas'..."
                    className="w-full pl-12 pr-4 py-4 bg-transparent text-white outline-none placeholder:text-slate-500 font-medium"
                    onKeyDown={(e) => e.key === "Enter" && fetchSuppliers()}
                  />
                </div>
              </div>
              <button
                onClick={fetchSuppliers}
                disabled={!mounted || loading || query.trim() === ""}
                className="px-8 py-4 bg-white text-slate-900 hover:bg-indigo-50 disabled:bg-slate-700 disabled:text-slate-400 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg whitespace-nowrap min-w-[200px]"
              >
                {loading ? "Searching..." : "Source Partners"}
              </button>
            </div>
          </div>
        </div>

        {hasSearched && !loading && suppliers.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-300">
                <FaFilter className="h-3.5 w-3.5 text-indigo-400" /> Refine
                results
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setResultsView("grid")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${resultsView === "grid" ? "bg-indigo-600 text-white" : "bg-[#0d1321] text-slate-400 hover:text-white"}`}
                  >
                    <FaTh className="h-3.5 w-3.5" /> Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultsView("map")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors border-l border-slate-700 ${resultsView === "map" ? "bg-indigo-600 text-white" : "bg-[#0d1321] text-slate-400 hover:text-white"}`}
                  >
                    <FaMapMarkedAlt className="h-3.5 w-3.5" /> Map
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 p-4 bg-slate-800/20 rounded-xl border border-slate-700/40">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-3 w-3" />
                  <input
                    type="text"
                    placeholder="Location"
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#0d1321] border border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-500 text-white w-36"
                  />
                </div>

                <div className="relative">
                  <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-3 w-3" />
                  <input
                    type="number"
                    min={0}
                    placeholder="Min employees"
                    value={minEmployees}
                    onChange={(e) => setMinEmployees(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#0d1321] border border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-500 text-white w-36"
                  />
                </div>

                <div className="relative">
                  <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 h-3 w-3" />
                  <input
                    type="number"
                    min={0}
                    placeholder="Max employees"
                    value={maxEmployees}
                    onChange={(e) => setMaxEmployees(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-[#0d1321] border border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-500 text-white w-36"
                  />
                </div>

                <select
                  value={revenueFilter}
                  onChange={(e) => setRevenueFilter(e.target.value)}
                  className="py-1.5 px-3 bg-[#0d1321] border border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-500 text-white max-w-[200px]"
                >
                  <option value="any">Any revenue</option>
                  <option value="under10">Under ~$10M</option>
                  <option value="10to50">~$10M – $50M</option>
                  <option value="50to100">~$50M – $100M</option>
                  <option value="over100">$100M+</option>
                </select>

                <input
                  type="number"
                  min={0}
                  placeholder="Min years active"
                  value={minYearsActive}
                  onChange={(e) => setMinYearsActive(e.target.value)}
                  className="px-3 py-1.5 bg-[#0d1321] border border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-500 text-white w-40"
                />

                {/* <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div> */}

                {/* <label
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm font-medium ${esgCertified ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400" : "bg-[#0d1321] border-slate-700 text-slate-400 hover:border-slate-500"}`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={esgCertified}
                    onChange={(e) => setEsgCertified(e.target.checked)}
                  />
                  <FaLeaf className="h-3 w-3" /> ESG
                </label>

                <label
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all text-sm font-medium ${isoCertified ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-[#0d1321] border-slate-700 text-slate-400 hover:border-slate-500"}`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={isoCertified}
                    onChange={(e) => setIsoCertified(e.target.checked)}
                  />
                  <FaAward className="h-3 w-3" /> ISO 9001
                </label> */}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Revenue bands use parsed ranges from listings (undisclosed
                revenue is hidden when a revenue filter is applied). Map pins
                use API coordinates when present, otherwise approximate city
                locations.
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-slate-800/20 border border-slate-800 rounded-2xl p-6 h-80 animate-pulse flex flex-col"
              >
                <div className="flex gap-4 mb-4">
                  <div className="h-12 w-12 bg-slate-700/50 rounded-xl"></div>
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-3/4 bg-slate-700/50 rounded"></div>
                    <div className="h-3 w-1/2 bg-slate-700/50 rounded"></div>
                  </div>
                </div>
                <div className="space-y-2 mb-6">
                  <div className="h-3 w-full bg-slate-700/50 rounded"></div>
                  <div className="h-3 w-4/5 bg-slate-700/50 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filteredSuppliers.length > 0 && resultsView === "map" && (
          <SupplierMapView
            suppliers={filteredSuppliers}
            onSelectCompany={(co) => handleOpenProfile(co)}
          />
        )}

        {!loading && filteredSuppliers.length > 0 && resultsView === "grid" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSuppliers.map((s) => {
              const isSelected = selectedForCompare.some(
                (comp) => comp.id === s.id,
              );
              return (
                <div
                  key={s.id}
                  onClick={() => handleOpenProfile(s)}
                  className={`group bg-[#0d1321] rounded-2xl border transition-all shadow-xl flex flex-col relative cursor-pointer hover:-translate-y-1 overflow-hidden ${isSelected ? "border-indigo-500 shadow-indigo-500/10" : "border-slate-800 hover:border-slate-600"}`}
                >
                  <CompanyIntelligenceCard
                    company={s}
                    compact
                    onViewDetails={(e) => {
                      e.stopPropagation();
                      handleOpenProfile(s);
                    }}
                    onCompare={(e) => toggleCompare(s, e)}
                    isCompareSelected={isSelected}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedForCompare.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 shadow-2xl shadow-black/50 rounded-2xl p-4 flex items-center gap-6 z-40">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Compare
            </span>
            <span className="text-white font-medium">
              {selectedForCompare.length} / 3
            </span>
          </div>

          <div className="flex gap-2">
            {selectedForCompare.map((s) => (
              <div
                key={s.id}
                className="h-10 w-10 bg-white rounded-lg flex items-center justify-center border border-slate-600 overflow-hidden relative group"
              >
                {s.logoUrl ? (
                  <img src={s.logoUrl} className="object-contain p-1" />
                ) : (
                  <FaBuilding className="text-slate-300" />
                )}
                <button
                  onClick={(e) => toggleCompare(s, e)}
                  className="absolute inset-0 bg-red-500/80 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity flex cursor-pointer"
                >
                  <FaTimes className="text-white h-3 w-3" />
                </button>
              </div>
            ))}
            {[...Array(3 - selectedForCompare.length)].map((_, i) => (
              <div
                key={`empty-${i}`}
                className="h-10 w-10 border border-dashed border-slate-600 rounded-lg bg-slate-800/50"
              ></div>
            ))}
          </div>

          <button
            disabled={selectedForCompare.length < 2}
            onClick={() => {
              setCompareModalTab("scores");
              setShowMatrixModal(true);
            }}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold rounded-xl transition-all flex items-center gap-2"
          >
            <FaScaleBalanced className="h-4 w-4" /> Compare companies
          </button>
        </div>
      )}

      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0f1a] border border-slate-700 rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[#0d1321]">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BsStars className="text-indigo-400" /> Compare companies
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex rounded-lg border border-slate-700 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setCompareModalTab("scores")}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors ${compareModalTab === "scores" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
                  >
                    Fit scores
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareModalTab("matrix")}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors border-l border-slate-700 ${compareModalTab === "matrix" ? "bg-indigo-600 text-white" : "bg-slate-900 text-slate-400 hover:text-white"}`}
                  >
                    Company details
                  </button>
                </div>
                <button
                  onClick={() => setShowMatrixModal(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1"
                  aria-label="Close"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            </div>

            {compareModalTab === "scores" && (
              <div className="overflow-auto p-4 sm:p-6">
                <p className="text-xs text-slate-500 mb-4">
                  Side-by-side fit scores (same model as result cards). Higher
                  is better; subscores are out of their max weights.
                </p>
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-900/80">
                        <th className="p-3 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                          Metric
                        </th>
                        {selectedForCompare.map((s) => (
                          <th
                            key={s.id}
                            className="p-3 text-white font-semibold align-bottom"
                          >
                            <div className="line-clamp-2">{s.name}</div>
                          </th>
                        ))}
                        {Array.from({
                          length: 3 - selectedForCompare.length,
                        }).map((_, i) => (
                          <th
                            key={`e-${i}`}
                            className="p-3 text-slate-600"
                          ></th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80">
                      <tr>
                        <td className="p-3 text-slate-400 font-medium">
                          Total fit score
                        </td>
                        {selectedForCompare.map((s) => (
                          <td key={s.id} className="p-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-indigo-300">
                                {s.fitScore ?? "—"}
                              </span>
                              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden max-w-[120px]">
                                <div
                                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                                  style={{
                                    width: `${Math.min(100, s.fitScore ?? 0)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                        ))}
                        {Array.from({
                          length: 3 - selectedForCompare.length,
                        }).map((_, i) => (
                          <td key={`fe-${i}`} className="p-3"></td>
                        ))}
                      </tr>
                      {[
                        ["aiSemantic", "AI semantic match", 100],
                        ["experience", "Experience", 40],
                        ["size", "Company size", 30],
                        ["brands", "Brands", 30],
                      ].map(([key, label, max]) => (
                        <tr key={key}>
                          <td className="p-3 text-slate-400">
                            {label}{" "}
                            <span className="text-slate-600">(max {max})</span>
                          </td>
                          {selectedForCompare.map((s) => {
                            const v = s.fitBreakdown?.[key] ?? 0;
                            return (
                              <td key={s.id} className="p-3 text-slate-200">
                                <div className="flex items-center gap-2">
                                  <span className="tabular-nums font-medium">
                                    {v}
                                  </span>
                                  <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[100px]">
                                    <div
                                      className={`h-full rounded-full ${key === "aiSemantic" ? "bg-gradient-to-r from-indigo-500 to-purple-500" : "bg-slate-500"}`}
                                      style={{
                                        width: `${Math.min(100, (v / max) * 100)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                          {Array.from({
                            length: 3 - selectedForCompare.length,
                          }).map((_, i) => (
                            <td key={`e-${key}-${i}`} className="p-3"></td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {compareModalTab === "matrix" && (
              <div className="overflow-auto p-0">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr>
                      <th className="p-6 border-b border-slate-800 bg-slate-900/50 w-48 sticky left-0 z-10 backdrop-blur-md">
                        <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                          Features
                        </span>
                      </th>
                      {selectedForCompare.map((s) => (
                        <th
                          key={s.id}
                          className="p-6 border-b border-slate-800 bg-slate-900/50 align-top w-72"
                        >
                          <div className="flex flex-col items-start gap-4">
                            <div className="h-16 w-16 bg-white rounded-xl flex items-center justify-center border border-slate-700 overflow-hidden p-1 shrink-0">
                              {s.logoUrl ? (
                                <img
                                  src={s.logoUrl}
                                  className="object-contain w-full h-full"
                                />
                              ) : (
                                <FaBuilding className="text-slate-300 h-8 w-8" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg line-clamp-2">
                                {s.name}
                              </h3>
                            </div>
                          </div>
                        </th>
                      ))}
                      {Array.from({
                        length: 3 - selectedForCompare.length,
                      }).map((_, i) => (
                        <th
                          key={`empty-th-${i}`}
                          className="p-6 border-b border-slate-800 bg-slate-900/50 w-72"
                        ></th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    <tr className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 border-r border-slate-800/50 font-medium text-slate-400 text-sm sticky left-0 bg-[#0a0f1a] z-10 align-top pt-5">
                        Categories
                      </td>
                      {selectedForCompare.map((s) => (
                        <td
                          key={s.id}
                          className="p-4 text-slate-300 text-sm border-r border-slate-800/50 last:border-0 align-top"
                        >
                          <div className="flex flex-wrap gap-1.5">
                            {s.categories.map((cat, i) => (
                              <span
                                key={i}
                                className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase tracking-wider rounded"
                              >
                                {cat}
                              </span>
                            ))}
                          </div>
                        </td>
                      ))}
                      {Array.from({
                        length: 3 - selectedForCompare.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-cat-${i}`}
                          className="p-4 border-r border-slate-800/50"
                        ></td>
                      ))}
                    </tr>

                    <tr className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 border-r border-slate-800/50 font-medium text-slate-400 text-sm sticky left-0 bg-[#0a0f1a] z-10">
                        Company Size
                      </td>
                      {selectedForCompare.map((s) => (
                        <td
                          key={s.id}
                          className="p-4 text-slate-300 text-sm border-r border-slate-800/50 last:border-0"
                        >
                          {s.employeeString} Employees
                        </td>
                      ))}
                      {Array.from({
                        length: 3 - selectedForCompare.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-size-${i}`}
                          className="p-4 border-r border-slate-800/50"
                        ></td>
                      ))}
                    </tr>

                    <tr className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 border-r border-slate-800/50 font-medium text-slate-400 text-sm sticky left-0 bg-[#0a0f1a] z-10 align-top pt-5">
                        Certifications
                      </td>
                      {selectedForCompare.map((s) => (
                        <td
                          key={s.id}
                          className="p-4 text-slate-300 text-sm border-r border-slate-800/50 last:border-0 align-top"
                        >
                          <ul className="space-y-1">
                            {s.certifications.map((cert, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <FaAward className="text-indigo-400 h-3 w-3" />{" "}
                                {cert}
                              </li>
                            ))}
                          </ul>
                        </td>
                      ))}
                      {Array.from({
                        length: 3 - selectedForCompare.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-cert-${i}`}
                          className="p-4 border-r border-slate-800/50"
                        ></td>
                      ))}
                    </tr>

                    <tr className="hover:bg-slate-800/20 transition-colors">
                      <td className="p-4 border-r border-slate-800/50 font-medium text-slate-400 text-sm sticky left-0 bg-[#0a0f1a] z-10 align-top">
                        Specific Products
                      </td>
                      {selectedForCompare.map((s) => (
                        <td
                          key={s.id}
                          className="p-4 text-slate-300 text-sm border-r border-slate-800/50 last:border-0 align-top"
                        >
                          <ul className="list-disc list-inside space-y-1.5">
                            {s.products.slice(0, 5).map((p, i) => (
                              <li key={i} className="truncate">
                                {p}
                              </li>
                            ))}
                          </ul>
                        </td>
                      ))}
                      {Array.from({
                        length: 3 - selectedForCompare.length,
                      }).map((_, i) => (
                        <td
                          key={`empty-cap-${i}`}
                          className="p-4 border-r border-slate-800/50"
                        ></td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
