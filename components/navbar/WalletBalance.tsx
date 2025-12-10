import React from "react";
import { Button } from "@heroui/react";
import CircularProgress from "@mui/material/CircularProgress";

export type WalletBalanceView = "inline" | "button";

interface WalletBalanceProps {
    view?: WalletBalanceView;
    className?: string;
    refreshInterval?: number; // ms
}

export const WalletBalance: React.FC<WalletBalanceProps> = ({
    view = "inline",
    className = "",
    refreshInterval = 10000, // 10 seconds
}) => {
    const [balance, setBalance] = React.useState<number | null>(null);
    const [loading, setLoading] = React.useState(true);

    const fetchBalance = React.useCallback(async () => {
        //setLoading(true);
        try {
            const res = await fetch("/api/wallet-balance");
            const data = await res.json();
            setBalance(data.balance ?? 0);
        } catch {
            setBalance(0);
        }
        setLoading(false);
    }, []);

    React.useEffect(() => {
        fetchBalance();
        if (refreshInterval > 0) {
            const interval = setInterval(fetchBalance, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchBalance, refreshInterval]);

    if (loading) {
        return view === "button" ? (
            <Button className={`w-full justify-start ${className}`} variant="light" startContent={<img src="/assets/wallet.png" style={{ width: 16, height: 16 }} />}>
                <CircularProgress size={16} />
            </Button>
        ) : (
            <span className={`flex items-center gap-1 text-success font-semibold ${className}`}>
                <img src="/assets/wallet.png" style={{ width: 16, height: 16 }} />
                <CircularProgress size={16} />
            </span>
        );
    }

    if (view === "button") {
        return (
            <Button className={`w-full justify-start ${className}`} variant="light" startContent={<img src="/assets/wallet.png" style={{ width: 16, height: 16 }} />}>
                {balance?.toFixed(2)} OMR&nbsp;
            </Button>
        );
    }

    // Inline view
    return (
        <div className="flex flex-col gap-1 items-start justify-start">
            <span className={`flex items-center gap-1 text-success font-semibold ${className}`}>
                <img src="/assets/wallet.png" style={{ width: 16, height: 16 }} />
                {balance?.toFixed(2)} OMR&nbsp;
            </span>
        </div>
    );
};