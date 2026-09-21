import {
  MAX_MVP_QUANTITY,
  MIN_MVP_QUANTITY,
} from "../../domain/money";

export const defaultQuantity = (): number => MIN_MVP_QUANTITY;

export const canDecreaseQuantity = (quantity: number): boolean =>
  Number.isSafeInteger(quantity) && quantity > MIN_MVP_QUANTITY;

export const canIncreaseQuantity = (quantity: number): boolean =>
  Number.isSafeInteger(quantity) && quantity < MAX_MVP_QUANTITY;

export const decreaseQuantity = (quantity: number): number =>
  canDecreaseQuantity(quantity) ? quantity - 1 : quantity;

export const increaseQuantity = (quantity: number): number =>
  canIncreaseQuantity(quantity) ? quantity + 1 : quantity;
