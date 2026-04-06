import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-6xl font-black text-primary mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-6">Page not found</p>
        <Link to="/">
          <Button className="bg-navy hover:bg-navy-light gap-2">
            <Home className="w-4 h-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}