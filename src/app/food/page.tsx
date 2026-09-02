import ComingSoon from "@/components/ComingSoon";
import FoodHome from "@/components/food/FoodHome";
import { SITES } from "@/lib/sites";

export default function FoodPage() {
  return SITES.food.ready ? <FoodHome /> : <ComingSoon site="food" />;
}
