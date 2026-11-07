// Store page components, looked up by store id from the app routes.
import { ComposedPageView } from "./taraba/composed";
import { CategoryPage, HomePage, ProductPage, SearchPage } from "./taraba/pages";
import { CartPage, CheckoutPage } from "./taraba/shop";

export const storePages = {
  taraba: { Home: HomePage, Category: CategoryPage, Product: ProductPage, Search: SearchPage, Cart: CartPage, Checkout: CheckoutPage, Composed: ComposedPageView },
} as const;
