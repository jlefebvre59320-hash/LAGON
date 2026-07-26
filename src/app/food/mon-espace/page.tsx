"use client";
import AccountSpace from "@/components/AccountSpace";

/* Sous /food : mêmes données, couleurs et marque St Barth Food, et on
   arrive sur ses favoris de restaurants plutôt que sur ses annonces. */
export default function FoodAccountPage() {
  return <AccountSpace site="food" defaultTab="resto_favs" />;
}
