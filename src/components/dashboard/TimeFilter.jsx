import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function TimeFilter({ value, onChange }) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="bg-muted">
        <TabsTrigger value="month" className="text-xs font-semibold">Month</TabsTrigger>
        <TabsTrigger value="quarter" className="text-xs font-semibold">Quarter</TabsTrigger>
        <TabsTrigger value="ytd" className="text-xs font-semibold">YTD</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}