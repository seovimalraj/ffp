import * as React from "react";
import { CalendarIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { cn } from "@/lib/utils";

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DatePickerWithRangeProps {
  date: DateRange;
  onDateChange: (date: DateRange) => void;
  className?: string;
}

export function DatePickerWithRange({
  date,
  onDateChange,
  className,
}: DatePickerWithRangeProps) {
  const [fromDate, setFromDate] = React.useState(
    date.from?.toISOString().split("T")[0] || ""
  );
  const [toDate, setToDate] = React.useState(
    date.to?.toISOString().split("T")[0] || ""
  );

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFromDate(value);
    const from = value ? new Date(value) : undefined;
    onDateChange({ from, to: date.to });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setToDate(value);
    const to = value ? new Date(value) : undefined;
    onDateChange({ from: date.from, to });
  };

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Input
        type="date"
        value={fromDate}
        onChange={handleFromChange}
        placeholder="From date"
        className="w-full"
      />
      <span className="text-gray-500">to</span>
      <Input
        type="date"
        value={toDate}
        onChange={handleToChange}
        placeholder="To date"
        className="w-full"
      />
    </div>
  );
}
