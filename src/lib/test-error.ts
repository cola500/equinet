// TEST FILE: Intentional TypeScript error for branch protection testing

export function brokenFunction() {
  const message: string = 123; // Type error: number assigned to string
  return message;
}

export const anotherError: number = "this is wrong"; // Type error: string assigned to number
