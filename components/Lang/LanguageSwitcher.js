"use client";
import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { Select, SelectItem, Button } from "@heroui/react";
import { GlobeAltIcon } from "@heroicons/react/24/outline";

const LanguageSwitcher = ({ className }) => {
    const { language, switchLanguage, supportedLanguages } = useLanguage();

    console.log("Current language:", language);
    return (
        <div>
            <Select
                aria-label="Select language"
                className={className || ''}
                startContent={<GlobeAltIcon className="w-5 h-5" />}
                selectedKeys={[language]}
                defaultSelectedKeys={['en']}
                onChange={e => switchLanguage(e.target.value)}
                style={{ fontFamily: language === 'ar' ? 'Noto Kufi Arabic Variable' : undefined, minWidth: 120 }}
            >
                {supportedLanguages.map(lang =>
                    <SelectItem key={lang.code}>
                        {lang.label}
                    </SelectItem>
                )}
            </Select>
        </div>
    );
};

export default LanguageSwitcher;