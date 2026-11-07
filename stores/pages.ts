// Store page components, looked up by store id from the app routes.
import { CategoryPage, HomePage, ProductPage } from "./taraba/pages";

export const storePages = {
  taraba: { Home: HomePage, Category: CategoryPage, Product: ProductPage },
} as const;
