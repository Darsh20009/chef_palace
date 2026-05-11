import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ICustomer, ILoyaltyCard } from "@shared/schema";
import { useTranslate } from "@/lib/useTranslate";

interface SearchCustomerProps {
  setSearchPhone: (phone: string) => void;
  searchPhone: string;
}

const SearchCustomer: React.FC<SearchCustomerProps> = ({ setSearchPhone, searchPhone }) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const tc = useTranslate();

  const { data: loyaltyCard, isLoading: isLoadingCard, error: cardError } = useQuery<ILoyaltyCard>({
    queryKey: [`/api/loyalty/cards/phone/${searchPhone}`],
    enabled: !!searchPhone && searchPhone.length === 9,
  });

  const { data: customers = [] } = useQuery<ICustomer[]>({
    queryKey: ["/api/customers"],
    enabled: false,
  });

  const handleSearch = () => {
    const cleanPhone = phoneNumber.trim().replace(/\s/g, '');

    if (cleanPhone.length !== 9) {
      toast({
        variant: "destructive",
        title: tc("رقم هاتف غير صحيح", "Invalid Phone Number"),
        description: tc("يرجى إدخال رقم هاتف مكون من 9 أرقام", "Please enter a 9-digit phone number"),
      });
      return;
    }

    if (!cleanPhone.startsWith('5')) {
      toast({
        variant: "destructive",
        title: tc("رقم هاتف غير صحيح", "Invalid Phone Number"),
        description: tc("يجب أن يبدأ رقم الهاتف بالرقم 5", "Phone number must start with 5"),
      });
      return;
    }

    if (!/^5\d{8}$/.test(cleanPhone)) {
      toast({
        variant: "destructive",
        title: tc("رقم هاتف غير صحيح", "Invalid Phone Number"),
        description: tc("صيغة رقم الهاتف غير صحيحة (مثال: 512345678)", "Incorrect phone format (example: 512345678)"),
      });
      return;
    }

    setSearchPhone(cleanPhone);
  };

  return (
    <div className="flex items-center gap-4">
      <Input
        type="tel"
        placeholder={tc("أدخل رقم الهاتف (5xxxxxxxx)", "Enter phone number (5xxxxxxxx)")}
        value={phoneNumber}
        onChange={(e) => setPhoneNumber(e.target.value)}
        onKeyPress={(e) => e.key === "Enter" && handleSearch()}
        className="pr-10 text-right"
        dir="ltr"
        data-testid="input-phone"
        maxLength={9}
      />
      <Button onClick={handleSearch} className="bg-primary hover:bg-primary/90 text-primary-foreground">
        {tc("بحث", "Search")}
      </Button>
    </div>
  );
};

export default SearchCustomer;
