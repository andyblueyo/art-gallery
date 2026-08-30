"use client";
import { TransactionTable } from "./TransactionTable";

interface MySalesProps {
  userId: string;
}

export function MySales({ userId }: MySalesProps) {
  return <TransactionTable userId={userId} direction="sales" />;
}
