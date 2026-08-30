"use client";
import { TransactionTable } from "./TransactionTable";

interface MyPurchasesProps {
  userId: string;
}

export function MyPurchases({ userId }: MyPurchasesProps) {
  return <TransactionTable userId={userId} direction="purchases" />;
}
