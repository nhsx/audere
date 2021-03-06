// Copyright (c) 2020 by Audere
//
// Use of this source code is governed by an LGPL-3.0 license that
// can be found in the LICENSE file distributed with this file.
export const zipCodeFormatter = (code: string) => {
  return code.replace(/[^0-9()-]/g, "");
};
