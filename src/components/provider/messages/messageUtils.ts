interface MessageBase {
  id: string
  createdAt: string
}

export function displayMessages<T extends MessageBase>(messages: T[]): T[] {
  return [...messages].reverse()
}
